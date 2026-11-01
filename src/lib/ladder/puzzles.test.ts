import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("word ladder pools", async () => {
  const { ladderForPuzzle, oneLetterApart, FOUR_LETTER } = await import("./puzzles");
  const ladders = (await import("./ladders.json")).default as Record<string, string[]>;

  it("has thousands of pairs per tier", () => {
    for (const t of ["medium", "hard", "expert"]) expect(ladders[t].length).toBeGreaterThanOrEqual(3000);
  });

  it("every day's route is a real chain of one-letter changes between the two words, at the stated par", () => {
    for (let n = 1; n <= 120; n++) {
      const l = ladderForPuzzle(n);
      expect(l.example[0]).toBe(l.start);
      expect(l.example[l.example.length - 1]).toBe(l.target);
      expect(l.par).toBe(l.example.length - 1);
      for (let i = 1; i < l.example.length; i++) {
        expect(oneLetterApart(l.example[i - 1], l.example[i])).toBe(true);
        expect(FOUR_LETTER.has(l.example[i])).toBe(true);
      }
      expect(l.par).toBeGreaterThanOrEqual(5); // medium and above only
    }
  });

  it("par rises with the tier", () => {
    const byTier: Record<string, number[]> = { medium: [], hard: [], expert: [] };
    for (let n = 1; n <= 140; n++) byTier[ladderForPuzzle(n).tier].push(ladderForPuzzle(n).par);
    expect(Math.min(...byTier.medium)).toBe(5);
    expect(Math.min(...byTier.hard)).toBe(6);
    expect(Math.min(...byTier.expert)).toBeGreaterThanOrEqual(7);
  });

  it("never repeats a pair across 2,000 days", async () => {
    const { pickFromPool, tierSlot } = await import("../schedule");
    const seen = new Set<string>();
    for (let n = 1; n <= 2000; n++) {
      const { tier, k } = tierSlot(n);
      const pair = pickFromPool(ladders[tier], k, 23);
      expect(seen.has(pair)).toBe(false);
      seen.add(pair);
    }
  });
});
