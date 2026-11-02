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

/** Splits a word into 2-4 letter pieces, deterministically per word. Short pieces fit together in many wrong ways. */
export function chunkWord(word: string): string[] {
  const rand = mulberry32([...word].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const pieces: string[] = [];
  let rest = word;
  while (rest.length > 4) {
    const len = rest.length === 5 ? 2 + Math.floor(rand() * 2) : rand() < 0.5 ? 2 : 3;
    pieces.push(rest.slice(0, len));
    rest = rest.slice(len);
  }
  pieces.push(rest);
  return pieces;
}

/** Spare pieces from other words: the fewer you can rule out, the harder the board. */
const DECOYS: Record<Tier, number> = { medium: 4, hard: 7, expert: 10 };
/** Minimum answer length per tier; short words are spotted at a glance. */
const MIN_LENGTH: Record<Tier, number> = { medium: 7, hard: 8, expert: 9 };

const TIER_INDEX: Record<Tier, number> = { medium: 0, hard: 1, expert: 2 };
const cache = new Map<number, { clues: SpliceClue[]; decoys: string[]; tier: Tier }>();

/**
 * Seven distinct words from the day's tier, chosen by a seed unique to that tier slot (so the same
 * set never returns) and no two answers sharing a first four letters (which would make clues confusable).
 */
export function spliceInfo(number: number) {
  let hit = cache.get(number);
  if (!hit) {
    const { tier, k } = tierSlot(number);
    const pool = BY_TIER[tier].filter((e) => e.w.length >= MIN_LENGTH[tier]);
    const rand = mulberry32((k * 3 + TIER_INDEX[tier] + 1) * 2246822519);
    const chosen: Entry[] = [];
    while (chosen.length < 7) {
      const e = pool[Math.floor(rand() * pool.length)];
      if (chosen.some((c) => c.w === e.w || c.w.slice(0, 4) === e.w.slice(0, 4))) continue;
      chosen.push(e);
    }
    const clues = chosen.map((e) => ({ clue: e.c, answer: e.w, chunks: chunkWord(e.w) }));
    const real = new Set(clues.flatMap((c) => c.chunks));
    const decoys: string[] = [];
    while (decoys.length < DECOYS[tier]) {
      const e = pool[Math.floor(rand() * pool.length)];
      const piece = chunkWord(e.w)[Math.floor(rand() * 2)];
      if (!real.has(piece) && !decoys.includes(piece)) decoys.push(piece);
    }
    hit = { tier, clues, decoys };
    cache.set(number, hit);
    if (cache.size > 6) cache.delete(cache.keys().next().value as number);
  }
  return hit;
}

export const spliceForPuzzle = (number: number): SpliceClue[] => spliceInfo(number).clues;

/** All pieces from all answers plus the decoys, in a seeded shuffled order the same for everyone that day. */
export function shuffledTiles(clues: SpliceClue[], decoys: string[], seed: number): string[] {
  const tiles = [...clues.flatMap((c) => c.chunks), ...decoys];
  const rand = mulberry32(seed);
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}
