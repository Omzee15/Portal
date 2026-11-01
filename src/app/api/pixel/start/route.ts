import { connection } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { MAX_GUESSES, pictureForPuzzle, renderLevel } from "@/lib/pixel/images";

export async function GET() {
  await connection();
  const puzzle = puzzleNumber();
  const pic = pictureForPuzzle(puzzle);
  try {
    return Response.json(
      { puzzle, tier: pic.tier, image: await renderLevel(pic, 0), maxGuesses: MAX_GUESSES },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "image_unavailable" }, { status: 503 });
  }
}
