import { describe, expect, it } from "vitest";
import { CATEGORIES, makeBundle, makeOddRounds } from "./generate";
import type { Tier } from "../schedule";

const TIERS: Tier[] = ["medium", "hard", "expert"];
const members = (title: string) => CATEGORIES.find((c) => c.title === title)!;

describe("category database", () => {
  it("is large and clean", () => {
    expect(CATEGORIES.length).toBeGreaterThan(100);
    expect(new Set(CATEGORIES.flatMap((c) => c.words)).size).toBeGreaterThan(1000);
    for (const c of CATEGORIES) {
      expect(c.words.length).toBeGreaterThanOrEqual(6);
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
          // each word fits only its own group
          for (const other of p) if (other !== g) expect(g.words.some((w) => members(other.title).words.includes(w))).toBe(false);
        }
        // no category outside the four holds four of the words
        for (const c of CATEGORIES) {
          if (p.some((g) => g.title === c.title)) continue;
          expect(all.filter((w) => c.words.includes(w)).length).toBeLessThan(4);
        }
      }
      expect(makeBundle(42, tier)).toEqual(makeBundle(42, tier));
    });
  }

  it("never repeats across 3,000 days", () => {
    const seen = new Set<string>();
    for (let k = 0; k < 1000; k++)
      for (const tier of TIERS) {
        const sig = makeBundle(k * 3 + TIERS.indexOf(tier) + 1, tier).map((g) => [...g.words].sort().join(",")).sort().join("|");
        expect(seen.has(sig)).toBe(false);
        seen.add(sig);
      }
    expect(seen.size).toBe(3000);
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
          // exactly 4 of the 5 share a category the odd word is not in; no other 4-of-5 grouping exists
          const groupsOfFour = CATEGORIES.filter((c) => r.items.filter((w) => c.words.includes(w)).length >= 4);
          expect(groupsOfFour.length).toBeGreaterThan(0);
          for (const c of groupsOfFour) expect(c.words.includes(r.odd)).toBe(false);
        }
      }
    });
  }

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
