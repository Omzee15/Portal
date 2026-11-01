import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "./fetch-retry";

const ok = () => new Response("fine", { status: 200 });
afterEach(() => vi.restoreAllMocks());

describe("fetchWithRetry", () => {
  it("retries a server error and then succeeds", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(ok());
    const r = await fetchWithRetry("http://x", {}, 3, 1);
    expect(await r.text()).toBe("fine");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("retries a network error and a 429", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(new Response("", { status: 429 })).mockResolvedValueOnce(ok());
    expect((await fetchWithRetry("http://x", {}, 3, 1)).status).toBe(200);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("gives up after the last try", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 502 }));
    await expect(fetchWithRetry("http://x", {}, 3, 1)).rejects.toThrow("HTTP 502");
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("does not retry a 404", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    await expect(fetchWithRetry("http://x", {}, 3, 1)).rejects.toThrow("HTTP 404");
    expect(f).toHaveBeenCalledTimes(1);
  });
});
