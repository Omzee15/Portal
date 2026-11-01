/** Pure Sudoku engine: solver, unique-solution generator, conflict detection. No I/O, no clock. */

export type Grid = number[]; // 81 cells, row-major, 0 = empty
const ALL = 0b1111111110; // bits 1..9

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const popcount = (m: number) => {
  let n = 0;
  for (; m; m &= m - 1) n++;
  return n;
};

/**
 * Counts solutions up to `limit`. With `rand`, digits are tried in random order and the first
 * solution found is written back into `grid` (used to build a full random grid).
 */
function search(grid: Grid, limit: number, rand?: () => number): number {
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = grid[i];
    if (v) {
      const bit = 1 << v;
      if (rows[rowOf(i)] & bit || cols[colOf(i)] & bit || boxes[boxOf(i)] & bit) return 0; // already contradictory
      rows[rowOf(i)] |= bit;
      cols[colOf(i)] |= bit;
      boxes[boxOf(i)] |= bit;
    }
  }
  let count = 0;

  const dfs = (): boolean => {
    // most-constrained empty cell first
    let best = -1;
    let bestMask = 0;
    let bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const mask = ALL & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]);
      const n = popcount(mask);
      if (n === 0) return false;
      if (n < bestN) {
        best = i;
        bestMask = mask;
        bestN = n;
        if (n === 1) break;
      }
    }
    if (best === -1) {
      count++;
      return rand !== undefined || count >= limit; // in fill mode keep the first solution and stop
    }
    const digits: number[] = [];
    for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
    if (rand) shuffle(digits, rand);
    const r = rowOf(best), c = colOf(best), b = boxOf(best);
    for (const d of digits) {
      const bit = 1 << d;
      grid[best] = d;
      rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      const stop = dfs();
      if (stop) return true;
      grid[best] = 0;
      rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
    }
    return false;
  };

  dfs();
  return count;
}

export function countSolutions(grid: Grid, limit = 2): number {
  return search(grid.slice(), limit);
}

export function solve(grid: Grid): Grid | null {
  const g = grid.slice();
  return search(g, 1) === 1 ? g : null;
}

import type { Tier } from "../schedule";
export type { Tier };
// No easy puzzles: the fewer the clues, the harder the logic needed.
export const GIVENS: Record<Tier, number> = { medium: 34, hard: 29, expert: 25 };

/** A puzzle with exactly one solution, fully determined by `seed`. */
export function generate(seed: number, tier: Tier): { puzzle: Grid; solution: Grid } {
  const rand = mulberry32(seed);
  const solution: Grid = new Array(81).fill(0);
  search(solution, 1, rand);

  const puzzle = solution.slice();
  const order = shuffle(Array.from({ length: 81 }, (_, i) => i), rand);
  let removable = 81 - GIVENS[tier];
  for (const cell of order) {
    if (removable === 0) break;
    const keep = puzzle[cell];
    puzzle[cell] = 0;
    if (countSolutions(puzzle, 2) === 1) removable--;
    else puzzle[cell] = keep; // removing it would make the puzzle ambiguous
  }
  return { puzzle, solution };
}

/** Cells that break a rule right now (the same digit twice in a row, column or box). */
export function conflicts(grid: Grid): boolean[] {
  const bad = new Array(81).fill(false);
  const groups: number[][] = [];
  for (let k = 0; k < 9; k++) {
    groups.push(Array.from({ length: 9 }, (_, j) => k * 9 + j));
    groups.push(Array.from({ length: 9 }, (_, j) => j * 9 + k));
    groups.push(Array.from({ length: 9 }, (_, j) => (Math.floor(k / 3) * 3 + Math.floor(j / 3)) * 9 + (k % 3) * 3 + (j % 3)));
  }
  for (const g of groups) {
    const seen = new Map<number, number>();
    for (const i of g) {
      const v = grid[i];
      if (!v) continue;
      if (seen.has(v)) {
        bad[i] = true;
        bad[seen.get(v)!] = true;
      } else seen.set(v, i);
    }
  }
  return bad;
}

export const toGrid = (s: string): Grid => [...s].map((c) => Number(c));
export const fromGrid = (g: Grid) => g.join("");
