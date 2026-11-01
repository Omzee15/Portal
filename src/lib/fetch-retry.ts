/** fetch() that retries transient failures (network errors, 429, 5xx) with growing pauses. 404 and other 4xx are final. */
export async function fetchWithRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
  tries = 3,
  baseDelayMs = 400,
): Promise<Response> {
  const { timeoutMs = 15000, ...rest } = init;
  let lastError: unknown = new Error("fetch failed");
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return res;
      if (res.status !== 429 && res.status < 500) throw new Error(`HTTP ${res.status}`); // a real "no", don't retry
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
      if (e instanceof Error && /^HTTP 4\d\d$/.test(e.message)) throw e;
    }
    if (attempt < tries - 1) await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
  }
  throw lastError;
}
