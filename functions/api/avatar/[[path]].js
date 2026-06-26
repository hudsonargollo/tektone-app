/**
 * Public avatar image by email — so transactional emails can embed real photos
 * (Gmail blocks data-URI images, and email clients can't send a session cookie).
 *
 *   GET /api/avatar?email=<email>  → image bytes, or 404 if none
 *
 * Only returns the stored profile photo; no other user data is exposed.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.KANBAN;
  const email = (new URL(request.url).searchParams.get("email") || "").trim().toLowerCase();
  if (!email || !kv) return new Response("Not found", { status: 404 });

  const raw = await kv.get("auth:users");
  if (!raw) return new Response("Not found", { status: 404 });
  let users;
  try {
    users = JSON.parse(raw);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const u = users.find((x) => String(x.email).toLowerCase() === email);
  const m = u?.avatar && /^data:(image\/[\w.+-]+);base64,(.+)$/i.exec(u.avatar);
  if (!m) return new Response("Not found", { status: 404 });

  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=300" },
  });
}
