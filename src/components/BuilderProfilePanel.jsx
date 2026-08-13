import { useEffect, useState } from "react";
import { ArrowLeft, Award, Flame, Lock, BookOpen } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

// "Jornada" — the builder's gamification profile: level/XP earned from
// reviewed tasks (see functions/_lib/gamification.js), a daily streak, and
// a 12-card deck of stoic + biblical wisdom that unlocks as levels climb.
// Distinct from ProfilePage.jsx, which is account settings (avatar, name,
// notifications) — this is the "how am I doing as a builder" view.
export default function BuilderProfilePanel({ onClose }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getBuilderProfile()
      .then(({ profile }) => setProfile(profile))
      .catch(() => setError("Não foi possível carregar sua jornada."));
  }, []);

  const levelFloor = profile ? xpForLevelFloor(profile.level) : 0;
  const span = profile ? Math.max(1, profile.nextLevelXp - levelFloor) : 1;
  const progressPct = profile ? Math.min(100, Math.round(((profile.xp - levelFloor) / span) * 100)) : 0;

  return (
    <div className="flex h-full w-full flex-col surface-2">
      <div className="flex items-center justify-between border-b border-ink/15 px-6 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="-ml-1.5 rounded-lg p-1.5 text-stone-500 hover:bg-ink/[0.05] hover:text-ink lg:hidden"
          >
            <ArrowLeft size={16} />
          </button>
          <Award size={15} className="text-action" />
          <span className="label-tech">Jornada</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {error && <p className="mb-3 font-mono text-[11px] text-danger">{error}</p>}

        {!profile ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-6xl space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile icon={Award} label="Nível" value={profile.level} />
              <StatTile icon={BookOpen} label="XP total" value={profile.xp} />
              <StatTile
                icon={Flame}
                label="Sequência"
                value={`${profile.currentStreak} ${profile.currentStreak === 1 ? "dia" : "dias"}`}
                highlight={profile.currentStreak > 0}
              />
              <StatTile
                icon={Award}
                label="Melhor sequência"
                value={profile.longestStreak > 0 ? `${profile.longestStreak} ${profile.longestStreak === 1 ? "dia" : "dias"}` : "—"}
              />
            </div>

            <div className="rounded-xl surface-3 p-5">
              <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] text-stone-500">
                <span>{profile.xp} XP</span>
                <span>próximo nível: {profile.nextLevelXp} XP</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
                <div
                  className="h-full rounded-full bg-action transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div>
              <p className="label-tech mb-3">Cartas de sabedoria</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {profile.cards.map((card) => (
                  <SkillCard key={card.id} card={card} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Cumulative XP at the FLOOR of a level (mirrors xpToReachLevel in
// functions/_lib/gamification.js) — used only to size the progress bar
// within the current level's span, not sent by the API.
function xpForLevelFloor(level) {
  if (level <= 1) return 0;
  const l = level - 1;
  return 50 * l * (l + 1);
}

function StatTile({ icon: Icon, label, value, highlight }) {
  return (
    <div className="rounded-xl surface-3 p-4">
      <div className={`mb-2 flex items-center gap-1.5 ${highlight ? "text-action" : "text-stone-400"}`}>
        <Icon size={14} />
        <span className="font-mono text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function SkillCard({ card }) {
  if (!card.unlocked) {
    return (
      <div className="rounded-xl border border-dashed border-ink/15 p-4 opacity-60">
        <div className="mb-2 flex items-center gap-2 text-stone-400">
          <Lock size={14} />
          <span className="font-mono text-[10px] uppercase tracking-wide">nível {card.levelReq}</span>
        </div>
        <p className="text-sm font-semibold text-stone-400">{card.skillName}</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl surface-3 p-4">
      <div className="mb-2 flex items-center gap-2 text-action">
        <BookOpen size={14} />
        <span className="font-mono text-[10px] uppercase tracking-wide">nível {card.levelReq}</span>
      </div>
      <p className="mb-3 text-sm font-bold text-ink">{card.skillName}</p>
      <blockquote className="mb-1 text-[13px] italic leading-relaxed text-ink/80">
        “{card.stoicQuote}”
      </blockquote>
      <p className="mb-3 font-mono text-[10px] text-stone-500">— {card.stoicSource}</p>
      <blockquote className="mb-1 text-[13px] italic leading-relaxed text-ink/80">
        “{card.bibleVerse}”
      </blockquote>
      <p className="font-mono text-[10px] text-stone-500">— {card.bibleRef}</p>
    </div>
  );
}
