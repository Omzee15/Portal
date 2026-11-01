import { connection } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { emojiForPuzzle, MAX_GUESSES } from "@/lib/emoji/puzzles";

export async function GET() {
  await connection();
  const puzzle = puzzleNumber();
  const p = emojiForPuzzle(puzzle);
  return Response.json({ puzzle, tier: p.tier, emoji: p.emoji, maxGuesses: MAX_GUESSES }, { headers: { "Cache-Control": "no-store" } });
}
