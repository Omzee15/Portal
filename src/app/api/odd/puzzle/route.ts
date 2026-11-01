import { connection } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { oddInfo } from "@/lib/odd/puzzles";

export async function GET() {
  await connection();
  const puzzle = puzzleNumber();
  const { puzzle: rounds, tier } = oddInfo(puzzle);
  return Response.json(
    { puzzle, tier, rounds: rounds.map((r) => r.items), seconds: 60 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
