/** Shared with the client. The word list stays in engine.ts so it's never sent to the browser. */
export type Stroke = { c: string; w: number; p: number[] };

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const ROUND_CHOICES = [2, 3, 4, 5];
export const TIME_CHOICES = [60_000, 80_000, 100_000, 120_000];
export const CHOOSE_MS = 15_000;
export const REVEAL_MS = 6_000;
export const MAX_POINTS = 4000;
export const MAX_CHAT = 60;
/** The last one is white, which works as an eraser. */
export const PALETTE = ["#2e2a26", "#b5533c", "#d8a93f", "#5f8a64", "#3f7a8a", "#8b5a8c", "#8a6a4a", "#ffffff"];
export const WIDTHS = [3, 8, 18];
