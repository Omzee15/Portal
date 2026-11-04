import { rateLimit } from "@/lib/rate-limit";
import { connection } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { shuffledTiles, spliceInfo } from "@/lib/splice/daily";

export async function GET(req: Request) {
  const limited = rateLimit(req, "splice-puzzle", 120);
  if (limited) return limited;
  await connection();
  const puzzle = puzzleNumber();
  const { clues, decoys, tier } = spliceInfo(puzzle);
  return Response.json(
    {
      puzzle,
      tier,
      // answers stay on the server; only the gentlest tier gives away each answer's length
      clues: clues.map((c) => ({ clue: c.clue, length: tier === "medium" ? c.answer.length : undefined })),
      tiles: shuffledTiles(clues, decoys, puzzle * 2654435761),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
