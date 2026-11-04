import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const req = (ip: string) => new Request("http://x/api", { headers: { "x-forwarded-for": ip } });

describe("rate limiter", async () => {
  const { rateLimit, clientId } = await import("./rate-limit");
  beforeEach(() => vi.stubEnv("RATE_LIMIT_DISABLED", ""));

  it("allows up to the limit, then answers 429 with Retry-After", async () => {
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) expect(rateLimit(req("1.1.1.1"), "a", 5, 60, t)).toBeNull();
    const r = rateLimit(req("1.1.1.1"), "a", 5, 60, t + 1000);
    expect(r?.status).toBe(429);
    expect(Number(r?.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await r!.json()).error).toBe("rate_limited");
  });

  it("counts each client and each scope separately", () => {
    const t = 2_000_000;
    for (let i = 0; i < 3; i++) rateLimit(req("2.2.2.2"), "a", 3, 60, t);
    expect(rateLimit(req("2.2.2.2"), "a", 3, 60, t)?.status).toBe(429);
    expect(rateLimit(req("3.3.3.3"), "a", 3, 60, t)).toBeNull(); // another client
    expect(rateLimit(req("2.2.2.2"), "b", 3, 60, t)).toBeNull(); // another scope
  });

  it("starts a fresh window once the old one ends", () => {
    const t = 3_000_000;
    for (let i = 0; i < 3; i++) rateLimit(req("4.4.4.4"), "a", 3, 60, t);
    expect(rateLimit(req("4.4.4.4"), "a", 3, 60, t + 1000)?.status).toBe(429);
    expect(rateLimit(req("4.4.4.4"), "a", 3, 60, t + 61_000)).toBeNull();
  });

  it("can be switched off for load tests", () => {
    vi.stubEnv("RATE_LIMIT_DISABLED", "1");
    for (let i = 0; i < 50; i++) expect(rateLimit(req("5.5.5.5"), "a", 1, 60, 4_000_000)).toBeNull();
  });

  it("uses the first address in x-forwarded-for", () => {
    expect(clientId(req("9.9.9.9, 10.0.0.1"))).toBe("9.9.9.9");
    expect(clientId(new Request("http://x"))).toBe("local");
  });
});
