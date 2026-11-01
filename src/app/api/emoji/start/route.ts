import { rateLimit } from "@/lib/rate-limit";
import { connection } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { emojiForPuzzle, MAX_GUESSES } from "@/lib/emoji/puzzles";

export async function GET(req: Request) {
  const limited = rateLimit(req, "emoji-start", 120);
  if (limited) return limited;
  await connection();
  const puzzle = puzzleNumber();
  const p = emojiForPuzzle(puzzle);
  return Response.json({ puzzle, tier: p.tier, emoji: p.emoji, maxGuesses: MAX_GUESSES }, { headers: { "Cache-Control": "no-store" } });
}
