import { connection } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { shuffledTiles, spliceInfo } from "@/lib/splice/daily";

export async function GET() {
  await connection();
  const puzzle = puzzleNumber();
  const { clues, tier } = spliceInfo(puzzle);
  return Response.json(
    {
      puzzle,
      tier,
      // answers stay on the server; the player only sees each clue and its length
      clues: clues.map((c) => ({ clue: c.clue, length: c.answer.length })),
      tiles: shuffledTiles(clues, puzzle * 2654435761),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
