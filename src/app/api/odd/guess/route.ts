import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { oddForPuzzle } from "@/lib/odd/puzzles";
import { decodeAttempt, encodeAttempt, attemptCookieOptions } from "@/lib/letterbox/attempt-cookie";

const COOKIE = "lb_odd";
const ACTION_ID = /^[A-Za-z0-9_-]{8,64}$/;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "odd-guess", 90);
  if (limited) return limited;
  let body: { round?: unknown; pick?: unknown; clientActionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("invalid_json");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return bad("invalid_json");
  const actionId = typeof body.clientActionId === "string" ? body.clientActionId : "";
  if (!ACTION_ID.test(actionId)) return bad("bad_action_id");
  const round = body.round;
  const pick = typeof body.pick === "string" ? body.pick.toLowerCase() : "";
  if (!Number.isInteger(round) || (round as number) < 0 || (round as number) > 2) return bad("bad_round");

  const number = puzzleNumber();
  const puzzle = oddForPuzzle(number);
  const prev = decodeAttempt(req.cookies.get(COOKIE)?.value);
  const state = prev && prev.puzzle === number ? prev : { puzzle: number, count: 0, lastActionId: "" };
  const isRetry = state.lastActionId === actionId;

  // `count` = rounds already answered. Rounds must be answered once, in order.
  const expected = isRetry ? state.count - 1 : state.count;
  if (round !== expected) return bad("wrong_round", 409);

  const r = puzzle[round as number];
  if (!r.items.includes(pick as never)) return bad("unknown_item");
  const count = isRetry ? state.count : state.count + 1;

  const res = NextResponse.json({
    correct: pick === r.odd,
    // The right answer only leaves the server after the round is answered.
    odd: r.odd,
    why: r.why,
    finished: count >= 3,
  });
  res.cookies.set(COOKIE, encodeAttempt({ puzzle: number, count, lastActionId: actionId }), attemptCookieOptions());
  res.headers.set("Cache-Control", "no-store");
  return res;
}
