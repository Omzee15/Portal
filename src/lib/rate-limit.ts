import "server-only";

/**
 * Fixed-window rate limiter, per client and per scope. In-memory, so each server instance counts on its own:
 * that blunts bursts and scripted guessing from one machine, but it is NOT a shared limit across instances.
 * For a hard limit on a multi-instance host, back it with a shared store (e.g. a free Redis tier) or the host's firewall.
 *
 * The client is taken from `x-forwarded-for`, which hosts such as Vercel set themselves. If the app is ever served
 * without a trusted proxy in front, that header can be forged, so don't rely on this limiter there.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function clientId(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "local";
}

/** Returns a 429 response when `scope` is over `limit` requests per `windowSec` for this client, otherwise null. */
export function rateLimit(req: Request, scope: string, limit: number, windowSec = 60, now = Date.now()): Response | null {
  if (process.env.RATE_LIMIT_DISABLED === "1") return null;
  const key = `${scope}:${clientId(req)}`;
  let b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowSec * 1000 };
    buckets.set(key, b);
    if (buckets.size > 5000) for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k); // keep memory bounded
  }
  b.count++;
  if (b.count <= limit) return null;
  return Response.json(
    { error: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((b.resetAt - now) / 1000))), "Cache-Control": "no-store" } },
  );
}
