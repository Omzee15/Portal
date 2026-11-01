import { rateLimit } from "@/lib/rate-limit";
import { connection } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { bundleInfo, MAX_MISTAKES, shuffledWords } from "@/lib/bundle/puzzles";

export async function GET(req: Request) {
  const limited = rateLimit(req, "bundle-puzzle", 120);
  if (limited) return limited;
  await connection(); // depends on the current IST day
  const puzzle = puzzleNumber();
  const { puzzle: groups, tier } = bundleInfo(puzzle);
  return Response.json(
    { puzzle, tier, words: shuffledWords(groups, puzzle), maxMistakes: MAX_MISTAKES },
    { headers: { "Cache-Control": "no-store" } },
  );
}
