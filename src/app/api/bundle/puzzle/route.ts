import { connection } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { bundleInfo, MAX_MISTAKES, shuffledWords } from "@/lib/bundle/puzzles";

export async function GET() {
  await connection(); // depends on the current IST day
  const puzzle = puzzleNumber();
  const { puzzle: groups, tier } = bundleInfo(puzzle);
  return Response.json(
    { puzzle, tier, words: shuffledWords(groups, puzzle), maxMistakes: MAX_MISTAKES },
    { headers: { "Cache-Control": "no-store" } },
  );
}
