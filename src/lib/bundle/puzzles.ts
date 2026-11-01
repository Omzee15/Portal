import "server-only";
import { makeBundle, type BundleGroup, type BundlePuzzle } from "../categories/generate";
import { mulberry32, tierSlot, type Tier } from "../schedule";

export type { BundleGroup, BundlePuzzle };
export type GroupColor = BundleGroup["color"];
export const MAX_MISTAKES = 4;

const TIER_INDEX: Record<Tier, number> = { medium: 0, hard: 1, expert: 2 };
const cache = new Map<number, { puzzle: BundlePuzzle; tier: Tier }>();

/**
 * Generated from a category database (see scripts/build-categories.mjs), so there is no list to run out of.
 * The seed is unique per tier slot, so the same puzzle never comes back.
 */
export function bundleForPuzzle(number: number): BundlePuzzle {
  return bundleInfo(number).puzzle;
}

export function bundleInfo(number: number) {
  let hit = cache.get(number);
  if (!hit) {
    const { tier, k } = tierSlot(number);
    hit = { puzzle: makeBundle(k * 3 + TIER_INDEX[tier] + 1, tier), tier };
    cache.set(number, hit);
    if (cache.size > 6) cache.delete(cache.keys().next().value as number);
  }
  return hit;
}

/** Seeded shuffle so everyone sees the same starting layout on a given day. */
export function shuffledWords(puzzle: BundlePuzzle, seed: number): string[] {
  const words = puzzle.flatMap((g) => g.words as string[]);
  const rand = mulberry32(seed);
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  return words;
}
