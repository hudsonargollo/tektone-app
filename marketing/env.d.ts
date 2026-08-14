declare global {
  interface CloudflareEnv {
    // Bound in wrangler.toml — direct Worker-to-Worker fetch to
    // tektone-hub, bypassing the same-zone routing ambiguity documented
    // there.
    HUB: Fetcher;
  }
}

export {};
