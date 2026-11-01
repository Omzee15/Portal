export type TileState = "correct" | "present" | "absent";

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

/**
 * Colours a guess against the answer. Handles repeated letters the standard
 * way: exact matches claim letters first, then "present" is handed out left to
 * right only while unclaimed copies of that letter remain.
 */
export function scoreGuess(guess: string, answer: string): TileState[] {
  const g = guess.toLowerCase();
  const a = answer.toLowerCase();
  const result: TileState[] = Array(g.length).fill("absent");
  const remaining = new Map<string, number>();

  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) {
      result[i] = "correct";
    } else {
      remaining.set(a[i], (remaining.get(a[i]) ?? 0) + 1);
    }
  }

  for (let i = 0; i < g.length; i++) {
    if (result[i] === "correct") continue;
    const left = remaining.get(g[i]) ?? 0;
    if (left > 0) {
      result[i] = "present";
      remaining.set(g[i], left - 1);
    }
  }

  return result;
}

export function isSolved(feedback: TileState[]): boolean {
  return feedback.length === WORD_LENGTH && feedback.every((s) => s === "correct");
}

/** Letter -> best state seen so far, for colouring the on-screen keyboard. */
export function keyboardStates(
  rows: { guess: string; feedback: TileState[] }[],
): Record<string, TileState> {
  const rank: Record<TileState, number> = { absent: 0, present: 1, correct: 2 };
  const out: Record<string, TileState> = {};
  for (const { guess, feedback } of rows) {
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i].toLowerCase();
      const prev = out[letter];
      if (!prev || rank[feedback[i]] > rank[prev]) out[letter] = feedback[i];
    }
  }
  return out;
}
