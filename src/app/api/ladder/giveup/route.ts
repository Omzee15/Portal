import { rateLimit } from "@/lib/rate-limit";
import { connection } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { ladderForPuzzle } from "@/lib/ladder/puzzles";

export async function POST(req: Request) {
  const limited = rateLimit(req, "ladder-giveup", 30);
  if (limited) return limited;
  await connection();
  const l = ladderForPuzzle(puzzleNumber());
  return Response.json({ par: l.par, example: l.example }, { headers: { "Cache-Control": "no-store" } });
}
