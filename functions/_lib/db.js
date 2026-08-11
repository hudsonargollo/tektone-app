// D1 `users` table helpers — Phase 1 of the Hub Tektone migration (users
// move wholesale out of KV `auth:users` into D1; see migrations/0001).

export async function getUserByEmail(db, email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
}

export async function listUsers(db) {
  const { results } = await db
    .prepare("SELECT * FROM users ORDER BY created_at")
    .all();
  return results;
}

export async function createUser(db, { email, name, title = null, salt, hash }) {
  await db
    .prepare(
      `INSERT INTO users (email, name, title, salt, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(email, name, title, salt, hash)
    .run();
  return getUserByEmail(db, email);
}

// Fills in salt/hash/name on a pre-provisioned row (created with no
// password by an admin/customer invite — see rbac.canSignUp) instead of
// inserting a fresh one.
export async function completeInvitedSignup(db, email, { name, salt, hash }) {
  await db
    .prepare(
      `UPDATE users SET name = COALESCE(name, ?), salt = ?, password_hash = ? WHERE email = ?`
    )
    .bind(name, salt, hash, email)
    .run();
  return getUserByEmail(db, email);
}

export async function touchLastLogin(db, email) {
  await db
    .prepare(`UPDATE users SET last_login = datetime('now') WHERE email = ?`)
    .bind(email)
    .run();
}

export async function updateUserFields(db, email, fields) {
  const cols = Object.keys(fields);
  if (!cols.length) return getUserByEmail(db, email);
  const set = cols.map((c) => `${c} = ?`).join(", ");
  await db
    .prepare(`UPDATE users SET ${set} WHERE email = ?`)
    .bind(...cols.map((c) => fields[c]), email)
    .run();
  return getUserByEmail(db, email);
}

export async function deleteUser(db, email) {
  await db.prepare("DELETE FROM users WHERE email = ?").bind(email).run();
}
