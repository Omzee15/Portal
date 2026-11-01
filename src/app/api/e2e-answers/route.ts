import { connection } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { answerForPuzzle } from "@/lib/letterbox/answers";
import { bundleForPuzzle } from "@/lib/bundle/puzzles";
import { oddForPuzzle } from "@/lib/odd/puzzles";
import { ladderForPuzzle } from "@/lib/ladder/puzzles";
import { pictureForPuzzle } from "@/lib/pixel/images";
import { emojiForPuzzle } from "@/lib/emoji/puzzles";
import { spliceForPuzzle } from "@/lib/splice/daily";
import { sudokuForPuzzle } from "@/lib/sudoku/daily";

/**
 * TEST ONLY. Reports today's answers so the browser tests can play real games.
 * It is disabled (404) unless the server was started with PORTAL_E2E=1, which must never be set in production.
 */
export async function GET() {
  await connection(); // read the env at request time; otherwise the 404 is frozen into the build
  if (process.env.PORTAL_E2E !== "1") return new Response("Not found", { status: 404 });
  const n = puzzleNumber();
  const pic = pictureForPuzzle(n);
  const emoji = emojiForPuzzle(n);
  return Response.json({
    puzzle: n,
    letterbox: answerForPuzzle(n),
    bundle: bundleForPuzzle(n).map((g) => ({ title: g.title, words: g.words })),
    odd: oddForPuzzle(n).map((r) => ({ items: r.items, odd: r.odd })),
    ladder: ladderForPuzzle(n),
    pixel: { title: pic.title, answers: pic.answers, tier: pic.tier },
    emoji: { title: emoji.title, answers: emoji.answers },
    splice: spliceForPuzzle(n),
    sudoku: sudokuForPuzzle(n).solution.join(""),
  });
}
