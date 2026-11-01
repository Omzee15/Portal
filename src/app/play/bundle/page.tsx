import Link from "next/link";
import { Suspense } from "react";
import { GameFrame } from "@/components/GameFrame";
import { connection } from "next/server";
import { istDateString, puzzleNumber } from "@/lib/puzzle-day";
import { Bundle } from "@/components/bundle/Bundle";

async function Game() {
  await connection();
  const puzzle = puzzleNumber();
  return (
    <GameFrame>
      <header className="flex items-center justify-between border-b-[1.5px] border-ink bg-mustard px-3 py-2">
        <Link href="/" aria-label="Back to Today" className="grid h-11 w-11 place-items-center rounded-xl border-[1.5px] border-ink bg-paper">
          ‹
        </Link>
        <div className="text-center">
          <h1 className="font-serif text-lg font-bold leading-none">Bundle</h1>
          <p className="font-pixel text-[10px]">NO. {puzzle} · {istDateString()}</p>
        </div>
        <span className="w-11" />
      </header>
      <Bundle puzzle={puzzle} date={istDateString()} />
    </GameFrame>
  );
}

export default function BundlePage() {
  return (
    <Suspense fallback={<div className="h-14 border-b-[1.5px] border-ink bg-mustard" />}>
      <Game />
    </Suspense>
  );
}
