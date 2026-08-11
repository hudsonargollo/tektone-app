// Retry wrapper for outbound fetch calls — same shape as
// growth/apps/codigo-internacional's worker/src/lib/retry.js. Retries on
// transient failures (429 rate-limit, 5xx, Anthropic's 529 "overloaded")
// with exponential backoff; anything else returns immediately (including a
// clean non-2xx the caller should handle itself, e.g. 401).
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504, 529]);

export async function fetchWithRetry(url, init, { tries = 2, baseMs = 400 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || !RETRYABLE_STATUS.has(res.status) || attempt === tries - 1) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
      if (attempt === tries - 1) throw err;
    }
    await new Promise((r) => setTimeout(r, baseMs * 2 ** attempt));
  }
  throw lastErr;
}
