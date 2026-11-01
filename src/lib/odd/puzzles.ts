import "server-only";
import { makeOddRounds, type OddRound } from "../categories/generate";
import { tierSlot, type Tier } from "../schedule";

export type { OddRound };
export type OddPuzzle = [OddRound, OddRound, OddRound];

const TIER_INDEX: Record<Tier, number> = { medium: 0, hard: 1, expert: 2 };
const cache = new Map<number, { puzzle: OddPuzzle; tier: Tier }>();

export function oddInfo(number: number) {
  let hit = cache.get(number);
  if (!hit) {
    const { tier, k } = tierSlot(number);
    hit = { puzzle: makeOddRounds(k * 3 + TIER_INDEX[tier] + 1, tier), tier };
    cache.set(number, hit);
    if (cache.size > 6) cache.delete(cache.keys().next().value as number);
  }
  return hit;
}

export const oddForPuzzle = (number: number): OddPuzzle => oddInfo(number).puzzle;
