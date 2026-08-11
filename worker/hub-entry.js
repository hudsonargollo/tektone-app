// Entry point for the tektone-hub Worker (tektone.com.br/hub/* + /task/*).
//
// The compiled Pages Functions handler (dist/_worker.js/index.js, built by
// `wrangler pages functions build` from functions/) still expects requests
// at root-relative paths ("/api/auth/login", "/assets/index-*.js", etc) —
// exactly how it worked as a Pages project at tasks.tektone.com.br. Since
// this Worker is now path-mounted at /hub and /task instead of owning a
// whole (sub)domain, every incoming request carries a prefix the compiled
// handler doesn't know about. Strip it here, before delegating, so nothing
// inside functions/ has to change.
import pagesHandler from "../dist/_worker.js/index.js";

const PREFIXES = ["/hub", "/task"];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const prefix = PREFIXES.find((p) => url.pathname === p || url.pathname.startsWith(`${p}/`));
    if (prefix) url.pathname = url.pathname.slice(prefix.length) || "/";
    return pagesHandler.fetch(new Request(url, request), env, ctx);
  },
};
