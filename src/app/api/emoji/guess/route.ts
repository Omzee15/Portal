import { NextRequest, NextResponse } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { emojiForPuzzle, isCorrect, MAX_GUESSES } from "@/lib/emoji/puzzles";
import { decodeAttempt, encodeAttempt } from "@/lib/letterbox/attempt-cookie";

const COOKIE = "lb_emoji";
const ACTION_ID = /^[A-Za-z0-9_-]{8,64}$/;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  let body: { guess?: unknown; clientActionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("invalid_json");
  }
  const actionId = typeof body.clientActionId === "string" ? body.clientActionId : "";
  const guess = typeof body.guess === "string" ? body.guess.trim().slice(0, 60) : "";
  if (!ACTION_ID.test(actionId)) return bad("bad_action_id");
  if (!guess) return bad("empty_guess");

  const number = puzzleNumber();
  const p = emojiForPuzzle(number);
  const prev = decodeAttempt(req.cookies.get(COOKIE)?.value);
  const state = prev && prev.puzzle === number ? prev : { puzzle: number, count: 0, lastActionId: "" };
  const isRetry = state.lastActionId === actionId;
  if (!isRetry && state.count >= MAX_GUESSES) return bad("out_of_guesses", 409);

  const correct = isCorrect(p, guess);
  const used = isRetry ? state.count : state.count + 1;
  const finished = correct || used >= MAX_GUESSES;

  const res = NextResponse.json({
    correct,
    step: used,
    finished,
    // one new hint per wrong guess; never the title until the game is over
    hint: !correct && !finished ? p.hints[Math.min(used - 1, 2)] : undefined,
    answer: finished ? p.title : undefined,
  });
  res.cookies.set(COOKIE, encodeAttempt({ puzzle: number, count: used, lastActionId: actionId }), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 48,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
