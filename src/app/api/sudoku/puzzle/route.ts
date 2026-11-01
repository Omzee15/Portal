import { connection } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { sudokuForPuzzle } from "@/lib/sudoku/daily";

export async function GET() {
  await connection();
  const puzzle = puzzleNumber();
  const { puzzle: grid, tier } = sudokuForPuzzle(puzzle);
  return Response.json({ puzzle, tier, givens: grid.join("") }, { headers: { "Cache-Control": "no-store" } });
}
