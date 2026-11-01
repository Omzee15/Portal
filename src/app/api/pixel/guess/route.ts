import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { isCorrect, MAX_GUESSES, pictureForPuzzle, renderLevel, stickerFor } from "@/lib/pixel/images";
import { decodeAttempt, encodeAttempt, attemptCookieOptions } from "@/lib/letterbox/attempt-cookie";

const COOKIE = "lb_pixel2";
const ACTION_ID = /^[A-Za-z0-9_-]{8,64}$/;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "pixel-guess", 90);
  if (limited) return limited;
  let body: { guess?: unknown; clientActionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("invalid_json");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return bad("invalid_json");
  const actionId = typeof body.clientActionId === "string" ? body.clientActionId : "";
  const guess = typeof body.guess === "string" ? body.guess.trim().slice(0, 40) : "";
  if (!ACTION_ID.test(actionId)) return bad("bad_action_id");
  if (!guess) return bad("empty_guess");

  const number = puzzleNumber();
  const pic = pictureForPuzzle(number);
  const prev = decodeAttempt(req.cookies.get(COOKIE)?.value);
  const state = prev && prev.puzzle === number ? prev : { puzzle: number, count: 0, lastActionId: "" };
  const isRetry = state.lastActionId === actionId;
  if (!isRetry && state.count >= MAX_GUESSES) return bad("out_of_guesses", 409);

  const correct = isCorrect(pic, guess);
  // `count` is the number of wrong guesses; a correct guess still uses a step.
  const used = isRetry ? state.count : state.count + 1;
  const finished = correct || used >= MAX_GUESSES;

  let res: NextResponse;
  try {
    res = NextResponse.json({
      correct,
      step: used,
      finished,
      // Only ever send the picture at the sharpness the player has earned.
      image: await renderLevel(pic, finished ? MAX_GUESSES - 1 : used),
      answer: finished ? pic.title : undefined,
      credit: finished ? { source: pic.source, license: pic.license } : undefined,
      sticker: correct ? await stickerFor(pic) : undefined,
    });
  } catch {
    return bad("image_unavailable", 503);
  }
  res.cookies.set(COOKIE, encodeAttempt({ puzzle: number, count: used, lastActionId: actionId }), attemptCookieOptions());
  res.headers.set("Cache-Control", "no-store");
  return res;
}
