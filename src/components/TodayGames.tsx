"use client";

import Link from "next/link";
import { computeStreak } from "@/lib/streak";
import { coreCount, playedDates, useResults } from "@/lib/store";

import { DAILIES, type Daily } from "@/lib/games";

function Card({ g, r }: { g: Daily; r?: { score: number; solved: boolean } }) {
  return (
    <Link
      href={`/play/${g.id}`}
      className={`card flex min-h-16 items-center justify-between p-3 ${g.bg} active:translate-x-px active:translate-y-px active:shadow-[2px_2px_0_var(--ink)]`}
    >
      <span>
        <span className="block font-serif text-lg font-bold leading-tight">{g.name}</span>
        <span className="text-xs">{r ? (r.solved ? "Done for today" : "Better luck tomorrow") : g.blurb}</span>
      </span>
      {r ? (
        <span className="font-pixel -rotate-3 rounded-md border-[1.5px] border-dashed border-ink bg-paper/70 px-2 py-1 text-xs">{g.stamp(r.score, r.solved)}</span>
      ) : (
        <span className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper">Play</span>
      )}
    </Link>
  );
}

export function StreakBadge({ today }: { today: string }) {
  const results = useResults();
  const { current } = computeStreak(playedDates(results), today);
  return (
    <span className="font-pixel rounded-full border-[1.5px] border-ink bg-terracotta px-3 py-1 text-sm" aria-label={`${current} day streak`}>
      🔥 {current}
    </span>
  );
}

export function TodayGames({ today }: { today: string }) {
  const results = useResults();
  const day = results[today] ?? {};
  const done = coreCount(day);
  const core = DAILIES.filter((g) => g.core);
  const more = DAILIES.filter((g) => !g.core);
  const moreDone = more.filter((g) => day[g.id]).length;

  return (
    <>
      <div className="mt-6 flex items-end justify-between">
        <h2 className="-rotate-1 bg-mustard px-2 py-0.5 font-serif font-bold">Today&apos;s dailies</h2>
        <span className="text-xs text-ink-soft">{done} of 3 done · ~4 min</span>
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {core.map((g) => (
          <li key={g.id}>
            <Card g={g} r={day[g.id]} />
          </li>
        ))}
      </ul>
      {done === 3 && (
        <p className="mt-4 rounded-xl border-[1.5px] border-dashed border-ink bg-paper-deep p-3 text-center text-sm">
          All three done. It&apos;s stamped in your <Link href="/journal" className="underline">journal</Link>.
        </p>
      )}
      <div className="mt-6 flex items-end justify-between">
        <h2 className="inline-block rotate-1 bg-teal px-2 py-0.5 font-serif font-bold">More dailies</h2>
        <span className="text-xs text-ink-soft">{moreDone} of {more.length} done</span>
      </div>
      <ul className="mt-3 grid gap-3 pb-4 md:grid-cols-2">
        {more.map((g) => (
          <li key={g.id}>
            <Card g={g} r={day[g.id]} />
          </li>
        ))}
      </ul>
    </>
  );
}

/** Desktop sidebar: streak, longest run, and a nudge toward the evening party. */
export function TodaySide({ today }: { today: string }) {
  const results = useResults();
  const { current, longest } = computeStreak(playedDates(results), today);
  return (
    <aside className="hidden flex-col gap-4 md:flex" aria-label="Your progress">
      <div className="card bg-paper-deep p-4">
        <h2 className="font-serif text-lg font-bold">Your streak</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[["Now", current], ["Longest", longest], ["Days", playedDates(results).size]].map(([l, v]) => (
            <div key={l as string}>
              <p className="font-pixel text-2xl">{v}</p>
              <p className="text-[11px] text-ink-soft">{l}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-soft">One free freeze a week, earned automatically. Never pay-to-restore.</p>
      </div>
      <Link href="/party" className="card block bg-mauve p-4 active:translate-x-px active:translate-y-px active:shadow-[2px_2px_0_var(--ink)]">
        <h2 className="font-serif text-lg font-bold">Party night</h2>
        <p className="mt-1 text-sm">Open a Fuse room and send the code to your friends. 2 to 12 players.</p>
        <span className="mt-3 inline-block rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper">Open a room</span>
      </Link>
      <Link href="/journal" className="card block bg-sage p-4 active:translate-x-px active:translate-y-px active:shadow-[2px_2px_0_var(--ink)]">
        <h2 className="font-serif text-lg font-bold">Your journal</h2>
        <p className="mt-1 text-sm">Every result is stamped on today&apos;s page, with calendar and stats.</p>
      </Link>
    </aside>
  );
}
