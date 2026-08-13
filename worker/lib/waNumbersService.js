/** Saved WhatsApp numbers for the link creator's quick-pick chip row. */
const uid = () => crypto.randomUUID();

export async function listWaNumbers(db) {
  const { results } = await db.prepare("SELECT * FROM wa_numbers ORDER BY created_at DESC").all();
  return results;
}

export async function createWaNumber(db, { label, phone }) {
  const l = String(label || "").trim();
  const p = String(phone || "").trim();
  if (!l || !p) throw new Error("Informe um nome e um número.");
  const id = uid();
  await db.prepare("INSERT INTO wa_numbers (id, label, phone) VALUES (?, ?, ?)").bind(id, l, p).run();
  return db.prepare("SELECT * FROM wa_numbers WHERE id = ?").bind(id).first();
}

export async function deleteWaNumber(db, id) {
  await db.prepare("DELETE FROM wa_numbers WHERE id = ?").bind(id).run();
  return { id, deleted: true };
}
