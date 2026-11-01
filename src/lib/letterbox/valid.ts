import "server-only";
import dictionary from "an-array-of-english-words";
import { allAnswers } from "./answers";

/**
 * Every 5-letter English word is an acceptable guess; only today's answer comes from the
 * curated pool in answers.ts. Answers are added explicitly so a curated word can never be rejected.
 */
export const VALID_GUESSES: ReadonlySet<string> = new Set([
  ...(dictionary as string[]).filter((w) => /^[a-z]{5}$/.test(w)),
  ...allAnswers(),
]);
