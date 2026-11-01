import "server-only";
import dictionary from "an-array-of-english-words";
import ladders from "./ladders.json";
import common from "./common4.json";
import { pickFromPool, tierSlot, type Tier } from "../schedule";

export type { Tier };
export type Ladder = { start: string; target: string; par: number; example: string[]; tier: Tier };

/** 4-letter words a step may use: any real word counts; par is measured on everyday words only. */
export const FOUR_LETTER = new Set((dictionary as string[]).filter((w) => /^[a-z]{4}$/.test(w)));

// Pairs come from scripts/build-ladder.mjs: every pair's shortest path over everyday words is known.
// medium = 5 steps, hard = 6, expert = 7 or more.
const POOLS = ladders as Record<Tier, string[]>;

const COMMON = new Set(common as string[]);
const neighbours = (w: string) => {
  const out: string[] = [];
  for (let i = 0; i < 4; i++)
    for (let c = 97; c < 123; c++) {
      const n = w.slice(0, i) + String.fromCharCode(c) + w.slice(i + 1);
      if (n !== w && COMMON.has(n)) out.push(n);
    }
  return out;
};

/** One shortest route over everyday words (breadth-first search). */
function shortestPath(a: string, b: string): string[] {
  const prev = new Map<string, string | null>([[a, null]]);
  let frontier = [a];
  while (frontier.length && !prev.has(b)) {
    const next: string[] = [];
    for (const w of frontier) for (const n of neighbours(w)) if (!prev.has(n)) { prev.set(n, w); next.push(n); }
    frontier = next;
  }
  const path: string[] = [];
  for (let w: string | null | undefined = b; w; w = prev.get(w)) path.unshift(w);
  return path;
}

const cache = new Map<number, Ladder>();

export function ladderForPuzzle(number: number): Ladder {
  let hit = cache.get(number);
  if (!hit) {
    const { tier, k } = tierSlot(number);
    const [start, target] = pickFromPool(POOLS[tier], k, 23).split(" ");
    const example = shortestPath(start, target);
    hit = { start, target, par: example.length - 1, example, tier };
    cache.set(number, hit);
    if (cache.size > 6) cache.delete(cache.keys().next().value as number);
  }
  return hit;
}

export const oneLetterApart = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++diff > 1) return false;
  return diff === 1;
};
