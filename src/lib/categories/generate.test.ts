import { describe, expect, it } from "vitest";
import { CATEGORIES, countSolutions, makeBundle, makeOddRounds } from "./generate";
import ODD from "./odd.json";

const SPLITS = ODD as unknown as { title: string; groups: Record<string, string[]> }[];
import type { Tier } from "../schedule";

const TIERS: Tier[] = ["medium", "hard", "expert"];
const members = (title: string) => CATEGORIES.find((c) => c.title === title)!;

describe("category database", () => {
  it("is large and clean", () => {
    expect(CATEGORIES.length).toBeGreaterThan(100);
    expect(new Set(CATEGORIES.flatMap((c) => c.words)).size).toBeGreaterThan(1000);
    expect(new Set(CATEGORIES.map((c) => c.title)).size).toBe(CATEGORIES.length);
    for (const c of CATEGORIES) {
      expect(c.words.length).toBeGreaterThanOrEqual(4);
      expect(new Set(c.words).size).toBe(c.words.length);
      expect(c.words.every((w) => /^[a-z]+$/.test(w))).toBe(true);
    }
  });
});

describe("Bundle generator", () => {
  for (const tier of TIERS) {
    it(`${tier}: 600 puzzles are valid, unambiguous and deterministic`, () => {
      for (let seed = 1; seed <= 600; seed++) {
        const p = makeBundle(seed, tier);
        const all = p.flatMap((g) => g.words);
        expect(new Set(all).size).toBe(16);
        for (const g of p) {
          const cat = members(g.title);
          expect(g.words.every((w) => cat.words.includes(w))).toBe(true);
        }
        // however tempting the overlaps, the sixteen words split only one way
        const cats = p.map((g) => members(g.title));
        expect(countSolutions(all, cats)).toBe(1);
        // the traps are really there
        const traps = all.filter((w) => cats.filter((c) => c.words.includes(w)).length > 1).length;
        expect(traps).toBeGreaterThanOrEqual({ medium: 1, hard: 2, expert: 3 }[tier]);
        // no category outside the four holds four of the words
        for (const c of CATEGORIES) {
          if (p.some((g) => g.title === c.title)) continue;
          expect(all.filter((w) => c.words.includes(w)).length).toBeLessThan(4);
        }
      }
      expect(makeBundle(42, tier)).toEqual(makeBundle(42, tier));
    });
  }

  it("almost never repeats a board across 3,000 days", () => {
    const seen = new Set<string>();
    for (let k = 0; k < 1000; k++)
      for (const tier of TIERS) {
        seen.add(makeBundle(k * 3 + TIERS.indexOf(tier) + 1, tier).map((g) => [...g.words].sort().join(",")).sort().join("|"));
      }
    expect(seen.size).toBeGreaterThan(2990);
  });
});

describe("Odd One generator", () => {
  for (const tier of TIERS) {
    it(`${tier}: every round has exactly one correct answer`, () => {
      for (let seed = 1; seed <= 400; seed++) {
        const rounds = makeOddRounds(seed, tier);
        expect(new Set(rounds.map((r) => r.items.join())).size).toBe(3);
        for (const r of rounds) {
          expect(r.items).toContain(r.odd);
          expect(new Set(r.items).size).toBe(5);
          expect(r.why.length).toBeGreaterThan(10);
        }
      }
    });
  }

  it("split rounds take all five from one category: four of one kind, the odd one of another", () => {
    for (let seed = 1; seed <= 200; seed++)
      for (const tier of TIERS)
        for (const r of makeOddRounds(seed, tier).filter((x) => x.why.startsWith("All "))) {
          // a title can appear twice (say "countries" split by continent and by coastline), so any one may fit
          const fits = SPLITS.filter((x) => r.why.startsWith(`All ${x.title},`)).some((x) => {
            const groupOf = (w: string) => Object.keys(x.groups).find((g) => x.groups[g].includes(w));
            const others = new Set(r.items.filter((w) => w !== r.odd).map(groupOf));
            return others.size === 1 && !others.has(undefined) && groupOf(r.odd) !== undefined && !others.has(groupOf(r.odd));
          });
          expect(fits, r.why).toBe(true);
        }
  });

  it("never asks about spelling: no letter counts, vowels or hidden words", () => {
    for (let seed = 1; seed <= 300; seed++)
      for (const tier of TIERS) for (const r of makeOddRounds(seed, tier)) expect(r.why).not.toMatch(/letters|vowel|hide|repeated/i);
  });

  it("split data: no item in two groups of one category, and every category has a group of four", () => {
    for (const x of SPLITS) {
      const all = Object.values(x.groups).flat();
      expect(new Set(all).size, x.title).toBe(all.length);
      expect(Object.values(x.groups).some((g) => g.length >= 4), x.title).toBe(true);
    }
  });

  it("rarely reuses a single round: 300 days hold at least 700 different rounds", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) for (const r of makeOddRounds(seed, "expert")) seen.add([...r.items].sort().join());
    expect(seen.size).toBeGreaterThan(700);
  });

  it("never repeats a round across thousands of days", () => {
    const seen = new Set<string>();
    for (let k = 0; k < 1000; k++)
      for (const tier of TIERS) {
        const rounds = makeOddRounds(k * 3 + TIERS.indexOf(tier) + 1, tier);
        const sig = rounds.map((r) => [...r.items].sort().join(",")).join("|");
        expect(seen.has(sig)).toBe(false);
        seen.add(sig);
      }
  });
});
