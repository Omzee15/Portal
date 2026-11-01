import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("wordsplice generator", async () => {
  const { chunkWord, spliceInfo } = await import("./daily");
  const pool = (await import("./pool.json")).default as { w: string; c: string; t: string }[];

  it("has a large pool in every tier, with clues that don't contain their answer", () => {
    for (const t of ["medium", "hard", "expert"]) expect(pool.filter((e) => e.t === t).length).toBeGreaterThan(1500);
    for (const e of pool) expect(e.c.toLowerCase().includes(e.w.slice(0, Math.max(4, e.w.length - 3)))).toBe(false);
  });

  it("chunks reassemble to the word, in pieces of 2-5 letters", () => {
    for (const e of pool.slice(0, 3000)) {
      const c = chunkWord(e.w);
      expect(c.join("")).toBe(e.w);
      expect(c.length).toBeGreaterThanOrEqual(2);
      expect(c.every((x) => x.length >= 2 && x.length <= 5)).toBe(true);
    }
  });

  it("builds 7 distinct answers per day and never repeats a set across 1,500 days", () => {
    const seen = new Set<string>();
    for (let n = 1; n <= 1500; n++) {
      const { clues } = spliceInfo(n);
      expect(new Set(clues.map((c) => c.answer)).size).toBe(7);
      const sig = clues.map((c) => c.answer).sort().join(",");
      expect(seen.has(sig)).toBe(false);
      seen.add(sig);
    }
  });
});
