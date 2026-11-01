import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { puzzleNumber } from "@/lib/puzzle-day";
import { sudokuForPuzzle } from "@/lib/sudoku/daily";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "sudoku-check", 60);
  if (limited) return limited;
  let body: { grid?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  const grid = typeof body.grid === "string" ? body.grid : "";
  if (!/^[0-9]{81}$/.test(grid)) return NextResponse.json({ error: "bad_grid" }, { status: 400 });

  const { puzzle, solution } = sudokuForPuzzle(puzzleNumber());
  const wrong: number[] = [];
  let filled = 0;
  for (let i = 0; i < 81; i++) {
    const v = Number(grid[i]);
    if (v) filled++;
    // givens can't be wrong; only report cells the player filled that differ from the solution
    if (v && !puzzle[i] && v !== solution[i]) wrong.push(i);
  }
  return NextResponse.json(
    { solved: filled === 81 && wrong.length === 0, filled, wrong },
    { headers: { "Cache-Control": "no-store" } },
  );
}
