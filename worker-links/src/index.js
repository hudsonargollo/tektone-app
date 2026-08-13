/**
 * go.tektone.com.br/<slug> -> wa.me/<phone>?text=<message>, or an arbitrary
 * destination URL, depending on the link's type. Reads the SAME hub-tektone
 * D1 database directly (env.DB bound below) — unlike Código Internacional's
 * own worker-links (which HTTP-calls a separate backend because its
 * redirector and CRM sit in different Cloudflare accounts), everything here
 * is one account, so there's no need for the extra hop.
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const slug = url.pathname.replace(/^\/+|\/+$/g, "");
    if (!slug) return Response.redirect("https://tektone.com.br", 302);

    let link;
    try {
      link = await env.DB.prepare("SELECT * FROM wa_links WHERE slug = ?").bind(slug).first();
    } catch {
      return new Response("Erro ao processar o link.", { status: 502 });
    }
    if (!link) return new Response("Link não encontrado.", { status: 404 });

    ctx.waitUntil(
      env.DB.prepare("UPDATE wa_links SET clicks = clicks + 1, last_clicked_at = datetime('now') WHERE slug = ?")
        .bind(slug)
        .run()
        .catch(() => {})
    );

    if (link.type === "url") {
      const target = String(link.url || "");
      if (!/^https?:\/\//i.test(target)) return new Response("Link inválido.", { status: 500 });
      return Response.redirect(target, 302);
    }

    const digits = String(link.phone || "").replace(/\D/g, "");
    if (!digits) return new Response("Link inválido.", { status: 500 });
    const withCC = digits.length <= 11 ? `55${digits}` : digits;
    const target = `https://wa.me/${withCC}${link.message ? `?text=${encodeURIComponent(link.message)}` : ""}`;
    return Response.redirect(target, 302);
  },
};
