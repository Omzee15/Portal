import "server-only";
import pools from "./answers.json";
import { pickFromPool, tierSlot } from "../schedule";

// Built by scripts/build-letterbox.mjs from word-frequency bands: common words are medium,
// rarer ones hard, rare ones expert. A word never repeats until its whole pool has been used.
const POOLS = pools as { medium: string[]; hard: string[]; expert: string[] };

export function answerForPuzzle(number: number): string {
  const { tier, k } = tierSlot(number);
  return pickFromPool(POOLS[tier], k, 11);
}

export const tierForAnswer = (number: number) => tierSlot(number).tier;

export function allAnswers(): readonly string[] {
  return [...POOLS.medium, ...POOLS.hard, ...POOLS.expert];
}
