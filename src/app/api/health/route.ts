import { connection } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { puzzleNumber } from "@/lib/puzzle-day";
import { answerForPuzzle } from "@/lib/letterbox/answers";
import { bundleForPuzzle } from "@/lib/bundle/puzzles";
import { oddForPuzzle } from "@/lib/odd/puzzles";
import { ladderForPuzzle } from "@/lib/ladder/puzzles";
import { emojiForPuzzle } from "@/lib/emoji/puzzles";
import { spliceForPuzzle } from "@/lib/splice/daily";
import { sudokuForPuzzle } from "@/lib/sudoku/daily";
import { pictureForPuzzle } from "@/lib/pixel/images";

/**
 * For uptime monitors. Builds today's puzzle for every game, so a broken content file or a failing generator
 * shows up here before a player hits it. Reveals nothing about the answers.
 */
export async function GET(req: Request) {
  const limited = rateLimit(req, "health", 60);
  if (limited) return limited;
  await connection();
  const n = puzzleNumber();
  const checks: Record<string, boolean> = {};
  const probe = (name: string, fn: () => unknown) => {
    try {
      checks[name] = !!fn();
    } catch {
      checks[name] = false;
    }
  };
  probe("letterbox", () => answerForPuzzle(n));
  probe("bundle", () => bundleForPuzzle(n));
  probe("odd-one", () => oddForPuzzle(n));
  probe("word-ladder", () => ladderForPuzzle(n));
  probe("emoji-decode", () => emojiForPuzzle(n));
  probe("wordsplice", () => spliceForPuzzle(n));
  probe("sudoku", () => sudokuForPuzzle(n));
  probe("pixel-peek", () => pictureForPuzzle(n));
  probe("cookie-secret", () => process.env.NODE_ENV !== "production" || !!process.env.LETTERBOX_COOKIE_SECRET);
  const ok = Object.values(checks).every(Boolean);
  return Response.json(
    { status: ok ? "ok" : "degraded", puzzle: n, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev", checks },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
