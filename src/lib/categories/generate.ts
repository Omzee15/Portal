import data from "./data.json";
import HIDDEN from "./hidden.json";
import { mulberry32, type Tier } from "../schedule";

export type Category = {
  id: string;
  title: string;
  family: string;
  kind: "set" | "blank-post" | "blank-pre" | "hidden";
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

/** Words that fit another category too: the traps a tier must contain, and how many wordplay groups it must use. */
const NEEDS: Record<Tier, { traps: number; tricky: number }> = {
  medium: { traps: 2, tricky: 1 },
  hard: { traps: 3, tricky: 2 },
  expert: { traps: 3, tricky: 3 },
};
const isTricky = (c: Category) => c.kind === "hidden" || c.family === "things";
const isBlank = (c: Category) => c.kind === "blank-post" || c.kind === "blank-pre";
const MAX_BLANKS: Record<Tier, number> = { medium: 1, hard: 1, expert: 2 };

/** A generator for one (seed, tier, attempt). Mixed properly: nearby seeds must not walk the same stream. */
const streamFor = (seed: number, tier: Tier, attempt: number, salt: number) =>
  mulberry32((Math.imul(seed + 1, 2654435761) ^ Math.imul(attempt + 1, 1597334677) ^ Math.imul(salt + tier.length * 31 + tier.charCodeAt(0), 2246822519)) >>> 0);

/** Categories sharing at least one word with `c`. */
const LINKS = new Map(
  CATEGORIES.map((c) => [c.id, CATEGORIES.filter((o) => o !== c && o.words.some((w) => c.words.includes(w)))] as const),
);
const LINKED = CATEGORIES.filter((c) => (LINKS.get(c.id)?.length ?? 0) >= 2);

/** Four categories chained by shared words, so that words on the board can be read two ways. */
function chooseCategories(r: Rand): Category[] {
  const cats = [pickOne(LINKED, r)];
  while (cats.length < 4) {
    const from = pickOne(cats, r);
    const options = (LINKS.get(from.id) ?? []).filter((c) => !cats.includes(c) && (c.family === "things" || c.kind !== "set" || r() < 0.4));
    if (!options.length) return [];
    cats.push(pickOne(options, r));
  }
  return cats;
}

/** How many ways the words can be split into the four categories, stopping at 2. */
export function countSolutions(words: string[], cats: { words: string[] }[]): number {
  const fits = words.map((w) => cats.flatMap((c, i) => (c.words.includes(w) ? [i] : [])));
  const room = cats.map(() => 4);
  let found = 0;
  const walk = (i: number) => {
    if (found > 1) return;
    if (i === words.length) return void found++;
    for (const c of fits[i]) {
      if (!room[c]) continue;
      room[c]--;
      walk(i + 1);
      room[c]++;
    }
  };
  walk(0);
  return found;
}

/**
 * Builds a Bundle for a tier from a seed. Words are chosen so that several fit two groups on the board, yet
 * only one split of all sixteen works, and no category outside the four could claim four of them.
 */
export function makeBundle(seed: number, tier: Tier): BundlePuzzle {
  for (let attempt = 0; attempt < 20000; attempt++) {
    const r = streamFor(seed, tier, attempt, 1009);
    const cats = chooseCategories(r);
    if (cats.length !== 4 || cats.filter(isBlank).length > MAX_BLANKS[tier]) continue;
    // after many misses the bar drops by one trap, so a rare seed still gets a puzzle
    const need = NEEDS[tier];
    if (cats.filter(isTricky).length < need.tricky) continue;
    // "Snakes" beside "Reptiles" is one category twice, not a trap
    if (cats.some((a, i) => cats.some((b, j) => j > i && a.words.filter((w) => b.words.includes(w)).length > 2))) continue;
    const traps = need.traps - (attempt > 12000 ? 1 : 0);

    const groups: string[][] = cats.map(() => []);
    const taken = new Set<string>();
    // first the words each group shares with a neighbour, then fill up
    for (const i of pickN([0, 1, 2, 3], 4, r)) {
      const shared = cats[i].words.filter((w) => !taken.has(w) && cats.some((o, j) => j !== i && o.words.includes(w)));
      for (const w of pickN(shared, 1 + Math.floor(r() * 2), r)) {
        groups[i].push(w);
        taken.add(w);
      }
    }
    for (let i = 0; i < 4; i++) {
      const rest = cats[i].words.filter((w) => !taken.has(w));
      for (const w of pickN(rest, 4 - groups[i].length, r)) {
        groups[i].push(w);
        taken.add(w);
      }
    }
    if (groups.some((g) => g.length !== 4)) continue;
    const all = groups.flat();
    if (new Set(all).size !== 16) continue;

    const onBoard = (w: string) => cats.filter((c) => c.words.includes(w)).length;
    if (all.filter((w) => onBoard(w) > 1).length < traps) continue;
    if (countSolutions(all, cats) !== 1) continue;

    // no accidental extra group
    const ov = overlap(all);
    if ([...ov].some(([id, n]) => !cats.some((c) => c.id === id) && n >= 4)) continue;

    const order = cats.map((c, i) => ({ c, g: groups[i] })).sort((x, y) => Number(isTricky(x.c)) - Number(isTricky(y.c)));
    return order.map(({ c, g }, i) => ({ title: c.title, color: COLORS[i], words: g as BundleGroup["words"] })) as BundlePuzzle;
  }
  throw new Error(`could not build a bundle for seed ${seed}`);
}

export type OddRound = { items: [string, string, string, string, string]; odd: string; why: string };

type Prop = { id: string; test: (w: string) => boolean; why: string; deep: boolean };
const VOWEL = /[aeiou]/;
const hides = (targets: string[]) => (w: string) => targets.some((t) => w !== t && w.includes(t));
const PROPS: Prop[] = [
  ...Object.entries(HIDDEN as Record<string, string[]>).map(([what, targets]) => ({
    id: `hides-${what}`,
    test: hides(targets),
    why: `The other four each hide ${/^[aeiou]/.test(what) ? "an" : "a"} ${what}`,
    deep: true,
  })),
  { id: "double", test: (w) => /(.)\1/.test(w), why: "The other four have a double letter", deep: false },
  { id: "bookend", test: (w) => w[0] === w[w.length - 1], why: "The other four start and end with the same letter", deep: true },
  { id: "vowel-start", test: (w) => VOWEL.test(w[0]), why: "The other four start with a vowel", deep: false },
  { id: "vowel-end", test: (w) => VOWEL.test(w[w.length - 1]), why: "The other four end in a vowel", deep: false },
  { id: "one-vowel", test: (w) => (w.match(/[aeiou]/g) ?? []).length === 1, why: "The other four have only one vowel", deep: true },
  { id: "repeat-free", test: (w) => w.length >= 6 && new Set(w).size === w.length, why: "The other four are 6+ letters with no letter repeated", deep: true },
  ...[4, 5, 6, 7, 8].map((n) => ({ id: `len-${n}`, test: (w: string) => w.length === n, why: `The other four have ${n} letters`, deep: false })),
];
const SURFACES = CATEGORIES.filter((c) => c.kind === "set" && c.words.length >= 9);

/** True if some other property would point at a different word, which would make the round unfair. */
const rivalAnswer = (five: string[], odd: string) =>
  PROPS.some((p) => {
    const yes = five.filter(p.test);
    if (yes.length === 1) return yes[0] !== odd;
    return yes.length === 4 && five.find((w) => !p.test(w)) !== odd;
  });

/** Five words from one category, so the category is no help: four share a hidden property, the fifth doesn't. */
function propertyRound(r: Rand, deepOnly: boolean, used: Set<string>): OddRound | null {
  const prop = pickOne(deepOnly ? PROPS.filter((p) => p.deep) : PROPS, r);
  const c = pickOne(SURFACES, r);
  if (used.has(c.id)) return null;
  const yes = c.words.filter(prop.test);
  const no = c.words.filter((w) => !prop.test(w));
  if (yes.length < 4 || !no.length) return null;
  const odd = pickOne(no, r);
  const five = [...pickN(yes, 4, r), odd];
  if (rivalAnswer(five, odd)) return null;
  used.add(c.id);
  return { items: pickN(five, 5, r) as OddRound["items"], odd, why: `All from "${c.title}", but the other four ${prop.why.replace("The other four ", "")}` };
}

/** Five ordinary words. Four hide the same kind of thing; the fifth hides something else, so it looks just as odd. */
function hiddenRound(r: Rand, used: Set<string>): OddRound | null {
  const groups = CATEGORIES.filter((c) => c.kind === "hidden");
  const x = pickOne(groups, r);
  const y = pickOne(groups.filter((c) => c !== x), r);
  const prop = PROPS.find((p) => p.id === `hides-${x.id.replace("hidden-", "").replace("bodypart", "body part")}`);
  if (!prop || used.has(x.id)) return null;
  const odd = pickOne(y.words.filter((w) => !prop.test(w)), r);
  const four = pickN(x.words, 4, r);
  if (!odd || four.includes(odd) || rivalAnswer([...four, odd], odd)) return null;
  used.add(x.id);
  return { items: pickN([...four, odd], 5, r) as OddRound["items"], odd, why: prop.why };
}

/** Four from a category and an intruder from a look-alike in the same family. */
function siblingRound(r: Rand, used: Set<string>): OddRound | null {
  const x = pickOne(SETS, r);
  if (used.has(x.id) || x.words.length < 6) return null;
  const y = pickOne(SETS.filter((c) => c.family === x.family && c.id !== x.id), r);
  if (!y) return null;
  const four = pickN(x.words, 4, r);
  const odd = pickOne(y.words.filter((w) => !x.words.includes(w)), r);
  if (!odd) return null;
  const ov = overlap([...four, odd]);
  if ([...ov].some(([id, n]) => id !== x.id && n >= 4)) return null;
  used.add(x.id);
  return { items: pickN([...four, odd], 5, r) as OddRound["items"], odd, why: `The other four are ${x.title.toLowerCase()}` };
}

/** Three rounds that get harder. Only medium has a plain category round, and expert needs a real look at the letters. */
export function makeOddRounds(seed: number, tier: Tier): [OddRound, OddRound, OddRound] {
  const plan: ("sibling" | "any" | "deep")[] = tier === "medium" ? ["sibling", "any", "any"] : tier === "hard" ? ["any", "any", "deep"] : ["any", "deep", "deep"];
  const rounds: OddRound[] = [];
  const used = new Set<string>();
  for (let attempt = 0; rounds.length < 3 && attempt < 40000; attempt++) {
    const r = streamFor(seed, tier, attempt, 7907);
    const kind = plan[rounds.length];
    const round = kind === "sibling" ? siblingRound(r, used) : kind === "deep" && r() < 0.6 ? hiddenRound(r, used) : propertyRound(r, kind === "deep", used);
    if (round) rounds.push(round);
  }
  if (rounds.length < 3) throw new Error(`could not build odd rounds for seed ${seed}`);
  return rounds as [OddRound, OddRound, OddRound];
}

export const categoryById = (id: string) => BY_ID.get(id);
