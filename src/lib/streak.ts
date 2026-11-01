import { addDays, daysBetween, weekStart } from "./dates";

export type StreakInfo = {
  current: number;
  longest: number;
  /** Missed days covered by a free weekly freeze. */
  frozen: Set<string>;
};

/**
 * A streak counts days with at least one daily finished. Each Monday-start
 * week earns one free freeze that automatically covers a single missed day,
 * but only inside a running streak (we never burn one before you've started).
 * Today being unplayed yet is not a miss.
 */
export function computeStreak(played: ReadonlySet<string>, today: string): StreakInfo {
  const frozen = new Set<string>();
  if (played.size === 0) return { current: 0, longest: 0, frozen };

  const first = [...played].sort()[0];
  const freezeUsed = new Set<string>(); // week starts
  let run = 0;
  let longest = 0;

  for (let d = first, n = daysBetween(first, today); n >= 0; d = addDays(d, 1), n--) {
    if (played.has(d)) {
      run++;
    } else if (d === today) {
      break; // still time to play today
    } else if (run > 0 && !freezeUsed.has(weekStart(d))) {
      freezeUsed.add(weekStart(d));
      frozen.add(d);
    } else {
      run = 0;
    }
    longest = Math.max(longest, run);
  }
  return { current: run, longest, frozen };
}
