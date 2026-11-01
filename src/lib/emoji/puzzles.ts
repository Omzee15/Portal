import "server-only";
import raw from "./puzzles.json";
import { pickFromPool, tierSlot, type Tier } from "../schedule";

export type EmojiPuzzle = {
  emoji: string;
  title: string;
  answers: string[];
  /** Shown one at a time after each wrong guess, vaguest first. */
  hints: [string, string, string];
  tier: Tier;
};

export const MAX_GUESSES = 4;

// Built by scripts/build-emoji.mjs. Hand-checked, so this pool is in the hundreds rather than thousands:
// compound words, dishes and films (medium), landmarks and harder films (hard), cryptic films (expert).
const POOL = raw as EmojiPuzzle[];
const BY_TIER: Record<Tier, EmojiPuzzle[]> = {
  medium: POOL.filter((p) => p.tier === "medium"),
  hard: POOL.filter((p) => p.tier === "hard"),
  expert: POOL.filter((p) => p.tier === "expert"),
};

export function emojiForPuzzle(number: number): EmojiPuzzle {
  const { tier, k } = tierSlot(number);
  return pickFromPool(BY_TIER[tier], k, 31);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/^(the|a|an) /, "");

export function isCorrect(p: EmojiPuzzle, guess: string): boolean {
  const g = norm(guess);
  return !!g && p.answers.some((a) => norm(a) === g || norm(a).replace(/ /g, "") === g.replace(/ /g, ""));
}
