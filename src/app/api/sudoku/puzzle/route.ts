import { rateLimit } from "@/lib/rate-limit";
import { connection } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { sudokuForPuzzle } from "@/lib/sudoku/daily";

export async function GET(req: Request) {
  const limited = rateLimit(req, "sudoku-puzzle", 120);
  if (limited) return limited;
  await connection();
  const puzzle = puzzleNumber();
  const { puzzle: grid, tier } = sudokuForPuzzle(puzzle);
  return Response.json({ puzzle, tier, givens: grid.join("") }, { headers: { "Cache-Control": "no-store" } });
}
