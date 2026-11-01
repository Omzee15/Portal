import "server-only";
import { tierFor } from "../schedule";
import { generate, type Grid, type Tier } from "./engine";

const cache = new Map<number, { puzzle: Grid; solution: Grid; tier: Tier }>();

export function sudokuForPuzzle(number: number) {
  let hit = cache.get(number);
  if (!hit) {
    const tier = tierFor(number);
    // The seed is salted so puzzle numbers don't map to a guessable public sequence.
    hit = { ...generate(number * 7919 + 104729, tier), tier };
    cache.set(number, hit);
    if (cache.size > 8) cache.delete(cache.keys().next().value as number);
  }
  return hit;
}
