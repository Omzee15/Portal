import data from "./data.json";
import { mulberry32, type Tier } from "../schedule";

export type Category = {
  id: string;
  title: string;
  family: string;
  kind: "set" | "blank-post" | "blank-pre";
  anchor?: string;
  words: string[];
};

export const CATEGORIES = data as Category[];
const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/** word -> ids of every category it belongs to */
const MEMBERSHIP = new Map<string, string[]>();
for (const c of CATEGORIES) for (const w of c.words) MEMBERSHIP.set(w, [...(MEMBERSHIP.get(w) ?? []), c.id]);
const membership = (w: string) => MEMBERSHIP.get(w) ?? [];

const SETS = CATEGORIES.filter((c) => c.kind === "set");
const BLANKS = CATEGORIES.filter((c) => c.kind !== "set");
const FAMILIES = [...new Set(SETS.map((c) => c.family))];

type Rand = () => number;
const pickOne = <T,>(a: T[], r: Rand) => a[Math.floor(r() * a.length)];
function pickN<T>(a: T[], n: number, r: Rand): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x.slice(0, n);
}

/** How many words of `words` each category contains. */
function overlap(words: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of words) for (const id of membership(w)) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}

export type BundleGroup = { title: string; color: "mustard" | "sage" | "teal" | "mauve"; words: [string, string, string, string] };
export type BundlePuzzle = [BundleGroup, BundleGroup, BundleGroup, BundleGroup];
const COLORS = ["mustard", "sage", "teal", "mauve"] as const;

/** Chooses the four categories for a tier: medium mixes families, hard pairs up look-alikes, expert adds wordplay. */
function chooseCategories(tier: Tier, r: Rand): Category[] {
  const fam = pickN(FAMILIES, 4, r);
  const fromFamily = (f: string, not: Category[] = []) => pickOne(SETS.filter((c) => c.family === f && !not.includes(c)), r);
  if (tier === "medium") {
    const sets = fam.slice(0, 3).map((f) => fromFamily(f));
    return [...sets, pickOne(BLANKS, r)];
  }
  // hard / expert: two sets from one family, so the groups look alike
  const twin = pickOne(FAMILIES.filter((f) => SETS.filter((c) => c.family === f).length >= 2), r);
  const a = fromFamily(twin);
  const b = fromFamily(twin, [a]);
  if (tier === "hard") return [a, b, fromFamily(fam.find((f) => f !== twin)!), pickOne(BLANKS, r)];
  const [w1, w2] = pickN(BLANKS, 2, r);
  return [a, b, w1, w2];
}

/**
 * Builds a Bundle for a tier from a seed. Rejects any arrangement that would be ambiguous: a chosen word
 * that fits two chosen groups, or four words that accidentally form a group nobody intended.
 */
export function makeBundle(seed: number, tier: Tier): BundlePuzzle {
  for (let attempt = 0; attempt < 400; attempt++) {
    const r = mulberry32(seed * 1009 + attempt);
    const cats = chooseCategories(tier, r);
    if (new Set(cats.map((c) => c.id)).size !== 4) continue;

    const groups: string[][] = [];
    for (const c of cats) {
      // red herrings: for harder tiers prefer words that also belong to other categories
      const pool = c.words.filter((w) => !cats.some((o) => o !== c && o.words.includes(w)));
      const multi = pool.filter((w) => membership(w).length > 1);
      const chosen =
        tier === "medium" || multi.length < 2
          ? pickN(pool, 4, r)
          : [...pickN(multi, 2, r), ...pickN(pool.filter((w) => !multi.includes(w)), 2, r)];
      if (chosen.length < 4) break;
      groups.push(chosen);
    }
    if (groups.length < 4) continue;
    const all = groups.flat();
    if (new Set(all).size !== 16) continue;

    // no accidental extra group: only the four chosen categories may hold 4+ of the words
    const ov = overlap(all);
    const bad = [...ov].some(([id, n]) => (cats.some((c) => c.id === id) ? n !== 4 : n >= 4));
    if (bad) continue;

    const order = cats.map((c, i) => ({ c, g: groups[i] })).sort((x, y) => Number(x.c.kind !== "set") - Number(y.c.kind !== "set"));
    return order.map(({ c, g }, i) => ({ title: c.title, color: COLORS[i], words: g as BundleGroup["words"] })) as BundlePuzzle;
  }
  throw new Error(`could not build a bundle for seed ${seed}`);
}

export type OddRound = { items: [string, string, string, string, string]; odd: string; why: string };

/** Three odd-one-out rounds. Harder tiers pick the intruder from a look-alike category. */
export function makeOddRounds(seed: number, tier: Tier): [OddRound, OddRound, OddRound] {
  const rounds: OddRound[] = [];
  const usedCats = new Set<string>();
  for (let attempt = 0; rounds.length < 3 && attempt < 800; attempt++) {
    const r = mulberry32(seed * 7907 + attempt);
    const x = pickOne(CATEGORIES, r);
    if (usedCats.has(x.id) || x.words.length < 4) continue;
    const sameFamily = CATEGORIES.filter((c) => c.family === x.family && c.id !== x.id);
    const otherFamily = CATEGORIES.filter((c) => c.family !== x.family);
    const y = pickOne(tier === "medium" || sameFamily.length === 0 ? otherFamily : sameFamily, r);
    const four = pickN(x.words, 4, r);
    const intruder = pickOne(y.words.filter((w) => !x.words.includes(w)), r);
    if (!intruder || four.includes(intruder)) continue;
    const five = [...four, intruder];
    // exactly one valid answer: no other category may hold 4 of these 5 words
    const ov = overlap(five);
    if ([...ov].some(([id, n]) => id !== x.id && n >= 4)) continue;
    if ((ov.get(x.id) ?? 0) !== 4) continue;
    usedCats.add(x.id);
    const items = pickN(five, 5, r) as OddRound["items"];
    rounds.push({
      items,
      odd: intruder,
      why: x.kind === "set" ? `The other four are ${x.title.toLowerCase()}` : `The other four fit ${x.title.toLowerCase()}`,
    });
  }
  if (rounds.length < 3) throw new Error(`could not build odd rounds for seed ${seed}`);
  return rounds as [OddRound, OddRound, OddRound];
}

export const categoryById = (id: string) => BY_ID.get(id);
