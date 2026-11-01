import { connection } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { ladderForPuzzle } from "@/lib/ladder/puzzles";

export async function GET() {
  await connection();
  const puzzle = puzzleNumber();
  const l = ladderForPuzzle(puzzle);
  return Response.json({ puzzle, start: l.start, target: l.target, tier: l.tier }, { headers: { "Cache-Control": "no-store" } });
}
