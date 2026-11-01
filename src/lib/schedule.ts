import { weekdayForPuzzle } from "./puzzle-day";

/** Difficulty tiers. There is no "easy": every daily is at least medium. */
export type Tier = "medium" | "hard" | "expert";

// Mon..Sun: the week opens at medium and peaks on Friday and Sunday.
export const WEEK: Tier[] = ["medium", "medium", "hard", "hard", "expert", "hard", "expert"];

export const tierFor = (number: number): Tier => WEEK[weekdayForPuzzle(number)];

/**
 * Which occurrence of its tier this day is (0-based). Walking a tier's pool by this number, through
 * a fixed shuffle, means a puzzle never repeats until that tier's whole pool has been used.
 */
export function tierSlot(number: number): { tier: Tier; k: number } {
  const tier = tierFor(number);
  let k = 0;
  for (let m = 1; m < number; m++) if (tierFor(m) === tier) k++;
  return { tier, k };
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const orders = new Map<string, number[]>();

/** A fixed shuffle of 0..len-1 for a pool, the same on every server. */
export function shuffledOrder(len: number, salt: number): number[] {
  const key = `${len}:${salt}`;
  let o = orders.get(key);
  if (!o) {
    const rand = mulberry32(salt * 2654435761 + len);
    o = Array.from({ length: len }, (_, i) => i);
    for (let i = len - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [o[i], o[j]] = [o[j], o[i]];
    }
    orders.set(key, o);
  }
  return o;
}

/** The pool entry for day-slot `k`: no repeats within `len` slots. */
export const pickFromPool = <T>(pool: readonly T[], k: number, salt: number): T =>
  pool[shuffledOrder(pool.length, salt)[k % pool.length]];

export { mulberry32 };
