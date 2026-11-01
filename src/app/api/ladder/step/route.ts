import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { FOUR_LETTER, ladderForPuzzle, oneLetterApart } from "@/lib/ladder/puzzles";

const bad = (error: string, status = 422) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "ladder-step", 120);
  if (limited) return limited;
  let body: { from?: unknown; to?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("invalid_json", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return bad("invalid_json", 400);
  const from = typeof body.from === "string" ? body.from.toLowerCase() : "";
  const to = typeof body.to === "string" ? body.to.toLowerCase() : "";
  if (!/^[a-z]{4}$/.test(from) || !/^[a-z]{4}$/.test(to)) return bad("bad_word", 400);
  if (!FOUR_LETTER.has(to)) return bad("not_a_word");
  if (!oneLetterApart(from, to)) return bad("not_one_letter");

  const l = ladderForPuzzle(puzzleNumber());
  const reached = to === l.target;
  return NextResponse.json(
    // par and the example route are only revealed once the ladder is done
    { ok: true, reached, par: reached ? l.par : undefined, example: reached ? l.example : undefined },
    { headers: { "Cache-Control": "no-store" } },
  );
}
