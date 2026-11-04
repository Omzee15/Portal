import { describe, expect, it } from "vitest";
import { isSolved, keyboardStates, scoreGuess } from "./scoring";
import { istDateString, puzzleNumber } from "../puzzle-day";

describe("scoreGuess", () => {
  it("marks an exact match", () => {
    expect(isSolved(scoreGuess("toast", "toast"))).toBe(true);
  });

  it("marks right spot, in word, and absent", () => {
    expect(scoreGuess("crane", "toast")).toEqual([
      "absent",
      "absent",
      "correct",
      "absent",
      "absent",
    ]);
    expect(scoreGuess("atoms", "toast")).toEqual([
      "present",
      "present",
      "present",
      "absent",
      "present",
    ]);
  });

  it("does not over-count a repeated letter in the guess", () => {
    // answer has one 'e', claimed by the exact match at the end,
    // so the earlier e's are absent; 'r' is in the word but misplaced
    expect(scoreGuess("eerie", "crane")).toEqual([
      "absent",
      "absent",
      "present",
      "absent",
      "correct",
    ]);
  });

  it("lets exact matches claim a letter before 'present' does", () => {
    // answer 'abbey' has two b's; guess 'babes' -> b(0) present, a(1) present, b(2) correct, e(3) correct
    expect(scoreGuess("babes", "abbey")).toEqual([
      "present",
      "present",
      "correct",
      "correct",
      "absent",
    ]);
  });

  it("is case-insensitive", () => {
    expect(scoreGuess("TOAST", "toast")).toEqual(scoreGuess("toast", "TOAST"));
  });
});

describe("keyboardStates", () => {
  it("keeps the strongest state per letter", () => {
    const states = keyboardStates([
      { guess: "crane", feedback: scoreGuess("crane", "toast") },
      { guess: "atoms", feedback: scoreGuess("atoms", "toast") },
    ]);
    expect(states.a).toBe("correct");
    expect(states.o).toBe("present");
    expect(states.c).toBe("absent");
  });
});

describe("puzzle day (IST)", () => {
  it("rolls over at midnight IST, not UTC", () => {
    // 18:29 UTC on 4 Nov = 23:59 IST on 4 Nov (launch day, No. 1)
    const beforeMidnightIST = Date.UTC(2026, 10, 4, 18, 29);
    // 18:30 UTC on 4 Nov = 00:00 IST on 5 Nov
    const midnightIST = Date.UTC(2026, 10, 4, 18, 30);
    expect(istDateString(beforeMidnightIST)).toBe("2026-11-04");
    expect(istDateString(midnightIST)).toBe("2026-11-05");
    expect(puzzleNumber(beforeMidnightIST)).toBe(1);
    expect(puzzleNumber(midnightIST)).toBe(2);
  });

  it("starts at No. 1 on launch day and never goes below it", () => {
    // 00:00 IST on 4 Nov
    expect(puzzleNumber(Date.UTC(2026, 10, 3, 18, 30))).toBe(1);
    expect(puzzleNumber(Date.UTC(2026, 9, 1))).toBe(1);
  });
});
