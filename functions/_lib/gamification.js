// "Builder profile" gamification engine — XP, levels, streaks, daily stats,
// and skill-card unlocks. See migrations/0013_hub_builder_profile.sql for
// the schema and the rationale for each table.
//
// Two call sites in functions/api/kanban/[[path]].js drive this:
//   - every PUT /cards/:id that changes columnId          -> logTaskEvent
//   - POST /cards/:id/review and /cards/review-bulk       -> logTaskEvent
//     (synthetic to_column "reviewed") + awardXpForReviewedTask
//
// XP is intentionally derived only from data the app already has (or that
// task_events starts capturing from here on) — no new "estimate" field, no
// cron job. "Recorded daily" is satisfied by upserting builder_daily_stats
// for today at the moment a task is reviewed, not by a scheduled batch job.

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

// ─── Level curve ────────────────────────────────────────────────────────
// Triangular growth: the cumulative XP required to REACH level L (for
// L >= 2) is 50*(L-1)*L. Level 1 is the free starting level (0 XP) — this
// means every builder unlocks skill_cards.level_req = 1 ("Disciplina")
// immediately, the moment their profile is first created, not after
// completing a task. That's deliberate: a "welcome" card, not an XP reward.
//   level 1 ->    0 XP
//   level 2 ->  100 XP
//   level 3 ->  300 XP
//   level 4 ->  600 XP
//   level 5 -> 1000 XP
//   ...
//   level 13-> 7800 XP (first level past the level_req=12 card ceiling)
function xpToReachLevel(level) {
  if (level <= 1) return 0;
  const l = level - 1;
  return 50 * l * (l + 1);
}

function levelForXp(xp) {
  let level = 1;
  // Card ceiling is 12, but XP keeps accruing past it — cap the search at a
  // generous level so this stays O(1)-ish without an unbounded loop.
  for (let l = 2; l <= 200; l++) {
    if (xp >= xpToReachLevel(l)) level = l;
    else break;
  }
  return level;
}

// ─── Assignee resolution ────────────────────────────────────────────────
// Mirrors the normalize+match logic in functions/api/kanban/[[path]].js's
// markReviewed(), but returns ALL resolved assignee emails (including the
// reviewer, if they're also an assignee) — markReviewed's `mentioned`
// deliberately excludes the reviewer to avoid a self-notification, but XP
// should still apply to a reviewer who completed their own task.
export function resolveAssigneeEmails(card, members) {
  const names = card.assignees?.length ? card.assignees : card.assignee ? [card.assignee] : [];
  const norm = (s) => String(s || "").trim().toLowerCase();
  return [
    ...new Set(
      names
        .map((n) => members.find((m) => norm(m.name) === norm(n))?.email)
        .filter(Boolean)
        .map((e) => e.toLowerCase())
    ),
  ];
}

// ─── Event log ──────────────────────────────────────────────────────────
export async function logTaskEvent(db, { taskId, projectId, fromColumn, toColumn, actorEmail }) {
  // Fail-open: this is an auxiliary feature layered onto the live kanban
  // board. A missing migration or transient DB error here must never break
  // the actual card move/review action for the caller.
  try {
    await db
      .prepare(
        `INSERT INTO task_events (id, task_id, project_id, from_column, to_column, actor_email, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(uid(), taskId, projectId ?? null, fromColumn ?? null, toColumn, actorEmail ?? null)
      .run();
  } catch (err) {
    console.error("logTaskEvent failed", err);
  }
}

// Has this task already been through the review flow before? Used to stop
// a reopen -> re-review loop from farming XP repeatedly on the same task.
async function wasAlreadyReviewed(db, taskId) {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM task_events WHERE task_id = ? AND to_column = 'reviewed'`)
    .bind(taskId)
    .first();
  return Number(row?.n || 0) > 0;
}

// First-ever "entered inprogress" timestamp for a task, if task_events has
// one — tasks created directly into a later column, or reviewed before this
// feature shipped, may have no such event; callers must handle null.
async function firstInProgressAt(db, taskId) {
  const row = await db
    .prepare(
      `SELECT created_at FROM task_events
        WHERE task_id = ? AND to_column = 'inprogress'
        ORDER BY created_at ASC LIMIT 1`
    )
    .bind(taskId)
    .first();
  return row?.created_at ?? null;
}

function hoursBetween(aIso, bIso) {
  const a = new Date(aIso.replace(" ", "T") + (aIso.includes("Z") ? "" : "Z"));
  const b = new Date(bIso.replace(" ", "T") + (bIso.includes("Z") ? "" : "Z"));
  return Math.abs(b.getTime() - a.getTime()) / 3_600_000;
}

// Brazil abolished DST in 2019, so America/Sao_Paulo is a fixed UTC-3
// offset year-round — no DST-transition edge cases to handle. Every
// "which calendar day did this happen on" decision in this file (streaks,
// daily stats buckets, on-time-vs-due-date) needs the team's local day, not
// UTC's — a review made at 22:00 in São Paulo is 01:00 UTC the *next* day,
// which a naive `.slice(0, 10)` on the ISO timestamp would silently bucket
// onto the wrong date and could snap or extend a streak incorrectly.
function saoPauloDateStr(isoOrSqlString) {
  const iso = isoOrSqlString.includes(" ") && !isoOrSqlString.includes("T")
    ? `${isoOrSqlString.replace(" ", "T")}Z`
    : isoOrSqlString.includes("Z") || /[+-]\d\d:\d\d$/.test(isoOrSqlString)
      ? isoOrSqlString
      : `${isoOrSqlString}Z`;
  const d = new Date(new Date(iso).getTime() - 3 * 3_600_000);
  return d.toISOString().slice(0, 10);
}

function yesterdayOf(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── XP formula ─────────────────────────────────────────────────────────
// +20 base for a reviewed task, +10 if reviewed by (or on) its due_date,
// +10/+5 speed bonus from actual cycle time when task_events has enough
// history to compute it (falls back to no bonus for tasks with no logged
// "inprogress" transition — e.g. anything reviewed before this migration).
async function computeTaskXp(db, { taskId, dueDate, createdAt, reviewedAtIso }) {
  let xp = 20;
  let onTime = false;

  if (dueDate) {
    onTime = saoPauloDateStr(reviewedAtIso) <= String(dueDate).slice(0, 10);
    if (onTime) xp += 10;
  }

  let cycleHours = null;
  const startedAt = await firstInProgressAt(db, taskId);
  if (startedAt) {
    cycleHours = hoursBetween(startedAt, reviewedAtIso);
    if (cycleHours <= 72) {
      xp += 10;
    } else if (dueDate && createdAt) {
      const totalWindow = hoursBetween(createdAt, dueDate);
      if (totalWindow > 0 && cycleHours <= totalWindow / 2) xp += 5;
    }
  }

  return { xp, onTime, cycleHours };
}

// ─── Card unlocks ───────────────────────────────────────────────────────
async function unlockCardsForLevelRange(db, email, projectId, oldLevel, newLevel) {
  if (newLevel <= oldLevel) return [];
  const { results } = await db
    .prepare(`SELECT id FROM skill_cards WHERE level_req > ? AND level_req <= ? ORDER BY level_req`)
    .bind(oldLevel, newLevel)
    .all();
  const unlocked = [];
  for (const row of results) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO builder_cards (email, card_id, project_id, unlocked_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(email, row.id, projectId ?? null)
      .run();
    unlocked.push(row.id);
  }
  return unlocked;
}

// ─── Profile bumps ──────────────────────────────────────────────────────
async function bumpGlobalProfile(db, email, deltaXp, statDate) {
  const existing = await db.prepare(`SELECT * FROM builder_profiles WHERE email = ?`).bind(email).first();

  if (!existing) {
    const xp = deltaXp;
    const level = levelForXp(xp);
    await db
      .prepare(
        `INSERT INTO builder_profiles (email, xp, level, current_streak, longest_streak, last_active_date, updated_at)
         VALUES (?, ?, ?, 1, 1, ?, datetime('now'))`
      )
      .bind(email, xp, level, statDate)
      .run();
    // oldLevel 0 so level_req=1's "welcome" card unlocks on first creation.
    const unlocked = await unlockCardsForLevelRange(db, email, null, 0, level);
    return { oldLevel: 0, newLevel: level, unlocked };
  }

  const oldLevel = existing.level;
  const xp = existing.xp + deltaXp;
  const newLevel = levelForXp(xp);

  let currentStreak = existing.current_streak;
  let longestStreak = existing.longest_streak;
  if (existing.last_active_date === statDate) {
    // already active today, streak unchanged
  } else if (existing.last_active_date === yesterdayOf(statDate)) {
    currentStreak += 1;
  } else {
    currentStreak = 1;
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  await db
    .prepare(
      `UPDATE builder_profiles
          SET xp = ?, level = ?, current_streak = ?, longest_streak = ?, last_active_date = ?, updated_at = datetime('now')
        WHERE email = ?`
    )
    .bind(xp, newLevel, currentStreak, longestStreak, statDate, email)
    .run();

  const unlocked = await unlockCardsForLevelRange(db, email, null, oldLevel, newLevel);
  return { oldLevel, newLevel, unlocked };
}

async function bumpProjectProfile(db, email, projectId, deltaXp) {
  if (!projectId) return null;
  const existing = await db
    .prepare(`SELECT * FROM builder_project_profiles WHERE email = ? AND project_id = ?`)
    .bind(email, projectId)
    .first();

  if (!existing) {
    const xp = deltaXp;
    const level = levelForXp(xp);
    await db
      .prepare(
        `INSERT INTO builder_project_profiles (email, project_id, xp, level, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
      )
      .bind(email, projectId, xp, level)
      .run();
    const unlocked = await unlockCardsForLevelRange(db, email, projectId, 0, level);
    return { oldLevel: 0, newLevel: level, unlocked };
  }

  const oldLevel = existing.level;
  const xp = existing.xp + deltaXp;
  const newLevel = levelForXp(xp);
  await db
    .prepare(
      `UPDATE builder_project_profiles SET xp = ?, level = ?, updated_at = datetime('now')
        WHERE email = ? AND project_id = ?`
    )
    .bind(xp, newLevel, email, projectId)
    .run();
  const unlocked = await unlockCardsForLevelRange(db, email, projectId, oldLevel, newLevel);
  return { oldLevel, newLevel, unlocked };
}

async function bumpDailyStats(db, email, statDate, { xp, onTime, cycleHours }) {
  const existing = await db
    .prepare(`SELECT * FROM builder_daily_stats WHERE email = ? AND stat_date = ?`)
    .bind(email, statDate)
    .first();

  if (!existing) {
    await db
      .prepare(
        `INSERT INTO builder_daily_stats (id, email, stat_date, tasks_completed, tasks_on_time, avg_cycle_hours, xp_earned, created_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, datetime('now'))`
      )
      .bind(uid(), email, statDate, onTime ? 1 : 0, cycleHours, xp)
      .run();
    return;
  }

  const tasksCompleted = existing.tasks_completed + 1;
  const tasksOnTime = existing.tasks_on_time + (onTime ? 1 : 0);
  const xpEarned = existing.xp_earned + xp;
  let avgCycleHours = existing.avg_cycle_hours;
  if (cycleHours != null) {
    avgCycleHours =
      avgCycleHours == null
        ? cycleHours
        : (avgCycleHours * (tasksCompleted - 1) + cycleHours) / tasksCompleted;
  }

  await db
    .prepare(
      `UPDATE builder_daily_stats
          SET tasks_completed = ?, tasks_on_time = ?, avg_cycle_hours = ?, xp_earned = ?
        WHERE email = ? AND stat_date = ?`
    )
    .bind(tasksCompleted, tasksOnTime, avgCycleHours, xpEarned, email, statDate)
    .run();
}

// ─── Entry point ────────────────────────────────────────────────────────
// Called once per (task, assignee) after a task is marked reviewed. Skips
// silently if this exact task has already been through a prior review (see
// wasAlreadyReviewed) — a reopen+re-review shouldn't re-earn XP. Never
// throws: a gamification hiccup should not fail the review action itself.
export async function awardXpForReviewedTask(db, { taskId, projectId, dueDate, createdAt, reviewedAtIso, assigneeEmails }) {
  try {
    if (!assigneeEmails?.length) return { skipped: "no-assignees" };
    if (await wasAlreadyReviewed(db, taskId)) return { skipped: "already-reviewed" };

    const { xp, onTime, cycleHours } = await computeTaskXp(db, { taskId, dueDate, createdAt, reviewedAtIso });
    const statDate = saoPauloDateStr(reviewedAtIso);

    const perAssignee = [];
    for (const email of assigneeEmails) {
      const global = await bumpGlobalProfile(db, email, xp, statDate);
      const project = await bumpProjectProfile(db, email, projectId, xp);
      await bumpDailyStats(db, email, statDate, { xp, onTime, cycleHours });
      perAssignee.push({ email, xp, global, project });
    }
    return { xp, onTime, cycleHours, perAssignee };
  } catch (err) {
    console.error("gamification award failed", err);
    return { error: String(err) };
  }
}

export async function getBuilderProfile(db, email) {
  const profile = await db.prepare(`SELECT * FROM builder_profiles WHERE email = ?`).bind(email).first();
  const cards = await db
    .prepare(
      `SELECT sc.id, sc.level_req, sc.skill_name, sc.stoic_quote, sc.stoic_source, sc.bible_verse, sc.bible_ref, sc.sort_order,
              bc.unlocked_at
         FROM skill_cards sc
         LEFT JOIN builder_cards bc ON bc.card_id = sc.id AND bc.email = ? AND bc.project_id IS NULL
        ORDER BY sc.sort_order`
    )
    .bind(email)
    .all();
  const { results: recentStats } = await db
    .prepare(
      `SELECT stat_date, tasks_completed, tasks_on_time, avg_cycle_hours, xp_earned
         FROM builder_daily_stats WHERE email = ? ORDER BY stat_date DESC LIMIT 30`
    )
    .bind(email)
    .all();

  return {
    email,
    xp: profile?.xp ?? 0,
    level: profile?.level ?? 1,
    currentStreak: profile?.current_streak ?? 0,
    longestStreak: profile?.longest_streak ?? 0,
    lastActiveDate: profile?.last_active_date ?? null,
    nextLevelXp: xpToReachLevel((profile?.level ?? 1) + 1),
    cards: cards.results.map((c) => ({
      id: c.id,
      levelReq: c.level_req,
      skillName: c.skill_name,
      sortOrder: c.sort_order,
      unlocked: Boolean(c.unlocked_at),
      unlockedAt: c.unlocked_at,
      // Content only goes to the client once unlocked — a locked card is a
      // silhouette (skill name + level required), not a spoiler.
      stoicQuote: c.unlocked_at ? c.stoic_quote : null,
      stoicSource: c.unlocked_at ? c.stoic_source : null,
      bibleVerse: c.unlocked_at ? c.bible_verse : null,
      bibleRef: c.unlocked_at ? c.bible_ref : null,
    })),
    recentStats,
  };
}

export async function getProjectBuilderProfiles(db, projectId) {
  const { results } = await db
    .prepare(
      `SELECT bpp.email, bpp.xp, bpp.level, u.name
         FROM builder_project_profiles bpp
         LEFT JOIN users u ON u.email = bpp.email
        WHERE bpp.project_id = ?
        ORDER BY bpp.xp DESC`
    )
    .bind(projectId)
    .all();
  return results.map((r) => ({ email: r.email, name: r.name || r.email, xp: r.xp, level: r.level }));
}
