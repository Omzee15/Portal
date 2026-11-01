import { describe, expect, it } from "vitest";
import { conflicts, countSolutions, generate, GIVENS, solve, type Grid, type Tier } from "./engine";

const valid = (g: Grid) => {
  const units: number[][] = [];
  for (let k = 0; k < 9; k++) {
    units.push(Array.from({ length: 9 }, (_, j) => g[k * 9 + j]));
    units.push(Array.from({ length: 9 }, (_, j) => g[j * 9 + k]));
    units.push(Array.from({ length: 9 }, (_, j) => g[(Math.floor(k / 3) * 3 + Math.floor(j / 3)) * 9 + (k % 3) * 3 + (j % 3)]));
  }
  return units.every((u) => [...u].sort().join("") === "123456789");
};

describe("sudoku generator", () => {
  for (const tier of ["medium", "hard", "expert"] as Tier[]) {
    it(`${tier}: valid solution, unique solution, right number of givens`, () => {
      const { puzzle, solution } = generate(214, tier);
      expect(valid(solution)).toBe(true);
      expect(puzzle.every((v, i) => v === 0 || v === solution[i])).toBe(true);
      expect(countSolutions(puzzle, 2)).toBe(1);
      expect(solve(puzzle)).toEqual(solution);
      const givens = puzzle.filter(Boolean).length;
      expect(givens).toBeGreaterThanOrEqual(GIVENS[tier]);
      expect(givens).toBeLessThanOrEqual(GIVENS[tier] + 6); // a few extra clues are kept if removing them would make it ambiguous
    });
  }

  it("is deterministic per seed and differs between seeds", () => {
    expect(generate(7, "medium").puzzle).toEqual(generate(7, "medium").puzzle);
    expect(generate(7, "medium").puzzle).not.toEqual(generate(8, "medium").puzzle);
  });

  it("a week of puzzles are all uniquely solvable", () => {
    for (let n = 214; n < 221; n++) {
      const { puzzle } = generate(n, n % 2 ? "expert" : "medium");
      expect(countSolutions(puzzle, 2)).toBe(1);
    }
  });
});

describe("solver and conflicts", () => {
  it("reports no solution for a contradictory grid", () => {
    const g: Grid = new Array(81).fill(0);
    g[0] = 5;
    g[1] = 5;
    expect(countSolutions(g)).toBe(0);
  });

  it("flags both cells of a repeated digit", () => {
    const g: Grid = new Array(81).fill(0);
    g[0] = 3;
    g[8] = 3; // same row
    g[40] = 4;
    const bad = conflicts(g);
    expect(bad[0] && bad[8]).toBe(true);
    expect(bad[40]).toBe(false);
  });
});
