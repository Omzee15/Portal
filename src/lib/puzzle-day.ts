const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Launch day: Wednesday 4 Nov 2026 (IST) is No. 1. */
const EPOCH_IST_DAY = Date.UTC(2026, 10, 4) / DAY_MS;

/** Days since the Unix epoch, counted on the IST calendar (resets at 00:00 IST). */
export function istDayIndex(now: number = Date.now()): number {
  return Math.floor((now + IST_OFFSET_MS) / DAY_MS);
}

/** 1-based puzzle number for the given moment. */
export function puzzleNumber(now: number = Date.now()): number {
  // never below 1, so a clock set before launch still gets the first puzzle
  return Math.max(1, istDayIndex(now) - EPOCH_IST_DAY + 1);
}

/** ISO date (YYYY-MM-DD) of the IST day containing `now`. */
export function istDateString(now: number = Date.now()): string {
  return new Date(istDayIndex(now) * DAY_MS).toISOString().slice(0, 10);
}

/** Weekday of a puzzle, Monday = 0 (1970-01-01 was a Thursday). */
export function weekdayForPuzzle(number: number): number {
  return (number - 1 + EPOCH_IST_DAY + 3) % 7;
}

/** Whole seconds until the next puzzle starts (00:00 IST). */
export function secondsUntilNextPuzzle(now: number = Date.now()): number {
  return Math.floor(((istDayIndex(now) + 1) * DAY_MS - IST_OFFSET_MS - now) / 1000);
}

/**
 * Headers for a response that is the same for every player for the whole IST day (no cookies, nothing personal).
 * The CDN keeps it until exactly midnight IST, so players get it from the edge near them instead of waiting on a
 * serverless function; browsers always recheck with the CDN so nobody keeps yesterday's puzzle past rollover.
 */
export function dailyCacheHeaders(now: number = Date.now()): Record<string, string> {
  const s = secondsUntilNextPuzzle(now);
  if (s < 5) return { "Cache-Control": "no-store" }; // too close to rollover to bother
  return {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "CDN-Cache-Control": `public, s-maxage=${s}`,
    "Netlify-CDN-Cache-Control": `public, durable, s-maxage=${s}`,
  };
}
