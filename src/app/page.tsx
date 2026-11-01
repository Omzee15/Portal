import { Suspense } from "react";
import { connection } from "next/server";
import { istDateString, puzzleNumber } from "@/lib/puzzle-day";
import { BottomNav } from "@/components/BottomNav";
import { StreakBadge, TodayGames, TodaySide } from "@/components/TodayGames";

async function TodayContent() {
  await connection();
  const today = istDateString();
  const date = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return (
    <div className="md:grid md:grid-cols-[1fr_320px] md:items-start md:gap-8">
      <div>
      <header className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">
            <span className="md:hidden">Portal</span>
            <span className="hidden md:inline">Today</span>
          </h1>
          <p className="font-serif text-sm italic text-ink-soft">
            {date} · No. {puzzleNumber()}
          </p>
        </div>
        <StreakBadge today={today} />
      </header>
      <TodayGames today={today} />
      </div>
      <TodaySide today={today} />
    </div>
  );
}

export default function Today() {
  return (
    <main className="flex min-h-dvh md:min-h-[640px] flex-col px-4 pt-5 md:px-6 md:pt-8">
      <Suspense fallback={<div className="h-40" />}>
        <TodayContent />
      </Suspense>
      <BottomNav active="today" />
    </main>
  );
}
