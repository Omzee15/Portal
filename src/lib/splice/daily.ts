import "server-only";
import pool from "./pool.json";
import { mulberry32, tierSlot, type Tier } from "../schedule";

export type SpliceClue = { clue: string; answer: string; chunks: string[] };
type Entry = { w: string; c: string; t: Tier };
const POOL = pool as Entry[];
const BY_TIER: Record<Tier, Entry[]> = {
  medium: POOL.filter((e) => e.t === "medium"),
  hard: POOL.filter((e) => e.t === "hard"),
  expert: POOL.filter((e) => e.t === "expert"),
};

/** Splits a word into 2-5 letter pieces, deterministically per word. */
export function chunkWord(word: string): string[] {
  const rand = mulberry32([...word].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const n = Math.max(2, Math.ceil(word.length / 4));
  const cuts: string[] = [];
  let rest = word;
  for (let i = n; i > 1; i--) {
    const even = rest.length / i;
    const len = Math.max(2, Math.min(rest.length - 2 * (i - 1), Math.round(even + (rand() < 0.5 ? -1 : 1) * (rand() < 0.5 ? 1 : 0))));
    cuts.push(rest.slice(0, len));
    rest = rest.slice(len);
  }
  cuts.push(rest);
  return cuts;
}

const TIER_INDEX: Record<Tier, number> = { medium: 0, hard: 1, expert: 2 };
const cache = new Map<number, { clues: SpliceClue[]; tier: Tier }>();

/**
 * Seven distinct words from the day's tier, chosen by a seed unique to that tier slot (so the same
 * set never returns) and no two answers sharing a first four letters (which would make clues confusable).
 */
export function spliceInfo(number: number) {
  let hit = cache.get(number);
  if (!hit) {
    const { tier, k } = tierSlot(number);
    const pool = BY_TIER[tier];
    const rand = mulberry32((k * 3 + TIER_INDEX[tier] + 1) * 2246822519);
    const chosen: Entry[] = [];
    while (chosen.length < 7) {
      const e = pool[Math.floor(rand() * pool.length)];
      if (chosen.some((c) => c.w === e.w || c.w.slice(0, 4) === e.w.slice(0, 4))) continue;
      chosen.push(e);
    }
    hit = { tier, clues: chosen.map((e) => ({ clue: e.c, answer: e.w, chunks: chunkWord(e.w) })) };
    cache.set(number, hit);
    if (cache.size > 6) cache.delete(cache.keys().next().value as number);
  }
  return hit;
}

export const spliceForPuzzle = (number: number): SpliceClue[] => spliceInfo(number).clues;

/** All pieces from all answers, in a seeded shuffled order the same for everyone that day. */
export function shuffledTiles(clues: SpliceClue[], seed: number): string[] {
  const tiles = clues.flatMap((c) => c.chunks);
  const rand = mulberry32(seed);
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}
