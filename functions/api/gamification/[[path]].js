// Builder-profile gamification reads (see migrations/0013_hub_builder_profile.sql
// and functions/_lib/gamification.js — writes happen from the kanban route,
// not here). Visibility: a builder can only read their own profile; ADMIN
// can read anyone's; a project-scoped roster is visible to STAFF/ADMIN or
// members of that project (same rule projects/[[path]].js uses elsewhere).
//
//   GET /api/gamification/me                    — my own profile
//   GET /api/gamification/user/:email            — ADMIN only
//   GET /api/gamification/project/:projectId     — roster for that project
import { getSessionEmail } from "../../_lib/session.js";
import { getUserByEmail } from "../../_lib/db.js";
import { isAdmin, isStaffOrAdmin, isProjectMember } from "../../_lib/rbac.js";
import { getBuilderProfile, getProjectBuilderProfiles } from "../../_lib/gamification.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 (DB) não vinculado." }, 500);
  if (request.method !== "GET") return json({ error: "Not found" }, 404);

  const email = await getSessionEmail(request, env);
  const user = email ? await getUserByEmail(db, email) : null;
  if (!user) return json({ error: "unauthorized" }, 401);

  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const [first, second] = seg;

  try {
    if (first === "me" || !first) {
      const profile = await getBuilderProfile(db, user.email);
      return json({ profile });
    }

    if (first === "user" && second) {
      if (!isAdmin(user)) return json({ error: "forbidden" }, 403);
      const target = await getUserByEmail(db, second);
      if (!target) return json({ error: "Usuário não encontrado" }, 404);
      const profile = await getBuilderProfile(db, second);
      return json({ profile });
    }

    if (first === "project" && second) {
      const projectId = second;
      const allowed = isStaffOrAdmin(user) || (await isProjectMember(db, user, projectId));
      if (!allowed) return json({ error: "forbidden" }, 403);
      const builders = await getProjectBuilderProfiles(db, projectId);
      return json({ builders });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
