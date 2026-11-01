import { NextRequest, NextResponse } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { answerForPuzzle, tierForAnswer } from "@/lib/letterbox/answers";
import { VALID_GUESSES } from "@/lib/letterbox/valid";
import {
  isSolved,
  MAX_GUESSES,
  scoreGuess,
  WORD_LENGTH,
} from "@/lib/letterbox/scoring";
import {
  ATTEMPT_COOKIE,
  decodeAttempt,
  encodeAttempt,
} from "@/lib/letterbox/attempt-cookie";

const ACTION_ID = /^[A-Za-z0-9_-]{8,64}$/;

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: NextRequest) {
  let body: { guess?: unknown; clientActionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("invalid_json");
  }

  const guess = typeof body.guess === "string" ? body.guess.toLowerCase() : "";
  const actionId =
    typeof body.clientActionId === "string" ? body.clientActionId : "";

  if (guess.length !== WORD_LENGTH || !/^[a-z]+$/.test(guess)) {
    return bad("bad_guess");
  }
  if (!ACTION_ID.test(actionId)) return bad("bad_action_id");
  if (!VALID_GUESSES.has(guess)) return bad("not_a_word", 422);

  const puzzle = puzzleNumber();
  const prev = decodeAttempt(req.cookies.get(ATTEMPT_COOKIE)?.value);
  // A cookie from yesterday's puzzle starts a fresh count.
  const state =
    prev && prev.puzzle === puzzle
      ? prev
      : { puzzle, count: 0, lastActionId: "" };

  // Retry of the request we already counted: answer again, don't count again.
  const isRetry = state.lastActionId === actionId;
  if (!isRetry && state.count >= MAX_GUESSES) return bad("out_of_guesses", 409);

  const count = isRetry ? state.count : state.count + 1;
  const answer = answerForPuzzle(puzzle);
  const feedback = scoreGuess(guess, answer);
  const solved = isSolved(feedback);
  const finished = solved || count >= MAX_GUESSES;

  const res = NextResponse.json({
    puzzle,
    tier: tierForAnswer(puzzle),
    step: count,
    feedback,
    solved,
    // The answer only leaves the server once the game is over.
    answer: finished ? answer : undefined,
  });
  res.cookies.set(
    ATTEMPT_COOKIE,
    encodeAttempt({ puzzle, count, lastActionId: actionId }),
    { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 48 },
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
}
