import { NextRequest, NextResponse } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { spliceForPuzzle } from "@/lib/splice/daily";

export async function POST(req: NextRequest) {
  let body: { tiles?: unknown; solved?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const tiles = Array.isArray(body.tiles) ? body.tiles.filter((t): t is string => typeof t === "string") : [];
  const solved = Array.isArray(body.solved) ? body.solved.filter((n): n is number => Number.isInteger(n)) : [];
  if (tiles.length < 2 || tiles.length > 6) return NextResponse.json({ error: "bad_tiles" }, { status: 400 });

  const word = tiles.join("").toLowerCase();
  const clues = spliceForPuzzle(puzzleNumber());
  const idx = clues.findIndex((c, i) => !solved.includes(i) && c.answer === word);
  return NextResponse.json(idx >= 0 ? { correct: true, clue: idx, answer: clues[idx].answer } : { correct: false }, {
    headers: { "Cache-Control": "no-store" },
  });
}
