import { describe, expect, it } from "vitest";
import pools from "./letterbox/answers.json";
import { pickFromPool, shuffledOrder, tierFor, tierSlot, WEEK } from "./schedule";

describe("difficulty ramp", () => {
  it("never offers an easy day and peaks on Friday and Sunday", () => {
    expect(WEEK).toEqual(["medium", "medium", "hard", "hard", "expert", "hard", "expert"]);
    // puzzle 214 is Saturday 31 Oct 2026
    expect(tierFor(214)).toBe("hard");
    expect(tierFor(213)).toBe("expert"); // Friday
    expect(tierFor(215)).toBe("expert"); // Sunday
  });

  it("counts occurrences of each tier so slots are consecutive", () => {
    const seen: Record<string, number[]> = { medium: [], hard: [], expert: [] };
    for (let n = 1; n <= 200; n++) {
      const { tier, k } = tierSlot(n);
      seen[tier].push(k);
    }
    for (const ks of Object.values(seen)) expect(ks).toEqual(ks.map((_, i) => i));
  });
});

describe("no repeats", () => {
  it("a shuffled order is a permutation (every index exactly once)", () => {
    const o = shuffledOrder(1117, 3);
    expect(new Set(o).size).toBe(1117);
    expect(Math.min(...o)).toBe(0);
    expect(Math.max(...o)).toBe(1116);
  });

  it("is the same order every time and differs between pools", () => {
    expect(shuffledOrder(100, 5)).toEqual(shuffledOrder(100, 5));
    expect(shuffledOrder(100, 5)).not.toEqual(shuffledOrder(100, 6));
  });

  it("walking a pool slot by slot never repeats until the pool is exhausted", () => {
    const pool = pools.hard;
    const seen = new Set<string>();
    for (let k = 0; k < pool.length; k++) seen.add(pickFromPool(pool, k, 11));
    expect(seen.size).toBe(pool.length);
  });

  it("Letterbox has thousands of answers across the tiers, all valid 5-letter words", () => {
    const all = [...pools.medium, ...pools.hard, ...pools.expert];
    expect(all.length).toBeGreaterThan(2000);
    expect(new Set(all).size).toBe(all.length); // no word in two tiers
    expect(all.every((w) => /^[a-z]{5}$/.test(w))).toBe(true);
  });
});
