import { NextRequest, NextResponse } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { bundleForPuzzle, MAX_MISTAKES } from "@/lib/bundle/puzzles";
import { decodeAttempt, encodeAttempt } from "@/lib/letterbox/attempt-cookie";

const COOKIE = "lb_bundle";
const ACTION_ID = /^[A-Za-z0-9_-]{8,64}$/;

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  let body: { words?: unknown; clientActionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("invalid_json");
  }
  const actionId = typeof body.clientActionId === "string" ? body.clientActionId : "";
  if (!ACTION_ID.test(actionId)) return bad("bad_action_id");

  const words = Array.isArray(body.words)
    ? body.words.filter((w): w is string => typeof w === "string").map((w) => w.toLowerCase())
    : [];
  if (words.length !== 4 || new Set(words).size !== 4) return bad("need_four_words");

  const number = puzzleNumber();
  const puzzle = bundleForPuzzle(number);
  const all = new Set(puzzle.flatMap((g) => g.words as string[]));
  if (!words.every((w) => all.has(w))) return bad("unknown_word");

  const prev = decodeAttempt(req.cookies.get(COOKIE)?.value);
  const state = prev && prev.puzzle === number ? prev : { puzzle: number, count: 0, lastActionId: "" };
  const isRetry = state.lastActionId === actionId;
  if (!isRetry && state.count >= MAX_MISTAKES) return bad("out_of_mistakes", 409);

  // How many of the four sit in the best-matching group.
  let best = 0;
  let hit: (typeof puzzle)[number] | undefined;
  for (const g of puzzle) {
    const n = words.filter((w) => (g.words as string[]).includes(w)).length;
    if (n > best) best = n;
    if (n === 4) hit = g;
  }

  const correct = !!hit;
  const mistakes = isRetry || correct ? state.count : state.count + 1;
  const lost = mistakes >= MAX_MISTAKES;

  const res = NextResponse.json({
    correct,
    group: hit,
    oneAway: !correct && best === 3,
    mistakes,
    lost,
    // The full solution leaves the server only once the game is lost.
    groups: lost ? puzzle : undefined,
  });
  res.cookies.set(COOKIE, encodeAttempt({ puzzle: number, count: mistakes, lastActionId: actionId }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 48,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
