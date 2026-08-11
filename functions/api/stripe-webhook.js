// Stripe webhook — verifies checkout.session.completed and marks the
// matching invoice PAID. Same pattern as growth/apps/codigo-internacional's
// stripeService.js: no Stripe SDK, Payment Links created by hand in the
// Stripe dashboard (client_reference_id = invoices.id, set by staff when
// they paste the link onto an invoice), this route only verifies signatures
// over crypto.subtle.
//
// NOT LIVE YET: requires env.STRIPE_WEBHOOK_SECRET (a Cloudflare secret,
// `wrangler secret put STRIPE_WEBHOOK_SECRET`) and a webhook configured in
// the Stripe dashboard pointing at /api/stripe-webhook. Until both exist
// this route 500s safely rather than silently accepting unverified events.
//
// Scheme: header `stripe-signature: t=<unix>,v1=<hex>[,v1=…]`;
// signed payload = `${t}.${rawBody}`, HMAC-SHA256 keyed by the whsec_ secret.

const TOLERANCE_SECONDS = 300; // Stripe default: reject events older than 5 min
const enc = new TextEncoder();

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a = "", b = "") {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(rawBody, header, secret) {
  if (!secret || !header) return false;
  const parts = String(header).split(",").map((p) => p.trim());
  const t = parts.find((p) => p.startsWith("t="))?.slice(2);
  const v1s = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || v1s.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > TOLERANCE_SECONDS) return false;
  const expected = await hmacHex(secret, `${t}.${rawBody}`);
  return v1s.some((v1) => safeEqual(expected, v1.toLowerCase()));
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return json({ error: "Not found" }, 404);

  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json({ error: "STRIPE_WEBHOOK_SECRET not configured" }, 500);
  if (!env.DB) return json({ error: "D1 (DB) não vinculado." }, 500);

  const rawBody = await request.text();
  const sigHeader = request.headers.get("stripe-signature");
  if (!(await verifyStripeSignature(rawBody, sigHeader, secret))) {
    return json({ error: "invalid signature" }, 401);
  }

  const event = JSON.parse(rawBody);
  if (event?.type !== "checkout.session.completed") {
    return json({ handled: false, ignored: event?.type });
  }

  const session = event.data?.object ?? {};
  const invoiceId = session.client_reference_id;
  if (!invoiceId) return json({ handled: false, reason: "no_reference" });

  const invoice = await env.DB.prepare("SELECT * FROM invoices WHERE id = ?").bind(invoiceId).first();
  if (!invoice) return json({ handled: false, reason: "no_match" });
  if (invoice.paid_at) return json({ handled: true, invoiceId, alreadyPaid: true });

  await env.DB
    .prepare(
      `UPDATE invoices SET status = 'PAID', paid_at = datetime('now'), stripe_payment_intent = ? WHERE id = ?`
    )
    .bind(session.payment_intent ?? session.id ?? null, invoiceId)
    .run();

  return json({ handled: true, invoiceId });
}
