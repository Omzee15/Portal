import "server-only";
import raw from "./puzzles.json";
import { pickFromPool, tierSlot, type Tier } from "../schedule";

export type EmojiPuzzle = {
  emoji: string;
  title: string;
  /** Movie, TV show, Book, Phrase, Song or Character: shown from the start */
  kind: string;
  answers: string[];
  /** Shown one at a time after each wrong guess, vaguest first. */
  hints: [string, string, string];
  tier: Tier;
};

export const MAX_GUESSES = 4;

// Built by scripts/build-emoji.mjs. Hand-written, so this pool is in the hundreds rather than thousands.
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

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/^(the|a|an) /, "");

/** True if `a` and `b` differ by at most one typo (swap, slip or missing letter). */
function oneTypo(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  const [x, y] = [a.slice(i), b.slice(i)];
  return x.slice(1) === y.slice(1) || x.slice(1) === y || x === y.slice(1) || (x[0] === y[1] && x[1] === y[0] && x.slice(2) === y.slice(2));
}

export function isCorrect(p: EmojiPuzzle, guess: string): boolean {
  const g = norm(guess);
  return !!g && p.answers.some((a) => {
    const n = norm(a).replace(/ /g, "");
    const t = g.replace(/ /g, "");
    return n === t || (n.length >= 6 && oneTypo(n, t));
  });
}
