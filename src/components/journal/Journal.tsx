"use client";

import { useState } from "react";
import { addDays, weekStart } from "@/lib/dates";
import { computeStreak } from "@/lib/streak";
import { DAILIES } from "@/lib/games";
import { coreCount, playedDates, setNote, useNotes, useResults, type Results } from "@/lib/store";

const TABS = ["Page", "Calendar", "Stats"] as const;
type Tab = (typeof TABS)[number];

const fmt = (d: string, o: Intl.DateTimeFormatOptions) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", ...o });

/** The journal writes its own lines from what you played. */
function autoLines(results: Results, date: string): string[] {
  const day = results[date] ?? {};
  const lines: string[] = [];
  for (const g of DAILIES) {
    const r = day[g.id];
    if (!r) continue;
    if (g.id === "letterbox" && r.solved) {
      const earlier = Object.entries(results)
        .filter(([d, x]) => d < date && x.letterbox?.solved)
        .map(([, x]) => x.letterbox!.score);
      const best = earlier.length > 0 && r.score < Math.min(...earlier);
      lines.push(`Solved Letterbox in ${r.score}${best ? ", your best so far" : ""}.`);
    } else {
      lines.push(g.line(r.score, r.solved));
    }
  }
  const fu = day.fuse;
  if (fu) lines.push(fu.solved ? "Fuse night: you outlasted everyone." : `Fuse night with ${fu.score} players.`);
  const ql = day.quicklist;
  if (ql) lines.push(ql.solved ? "Quicklist night: you topped the table." : `Quicklist night with ${ql.score} players.`);
  return lines;
}

function onThisDay(results: Results, date: string): { date: string; text: string } | null {
  for (const back of [7, 14, 30, 90, 365]) {
    const d = addDays(date, -back);
    const lines = autoLines(results, d);
    if (lines.length) return { date: d, text: lines[0] };
  }
  return null;
}

function PageView({ today }: { today: string }) {
  const results = useResults();
  const notes = useNotes();
  const [date, setDate] = useState(today);
  const day = results[date] ?? {};
  const lines = autoLines(results, date);
  const streak = computeStreak(playedDates(results), today);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i));
  const rawSticker = day["pixel-peek"]?.sticker;
  const sticker = typeof rawSticker === "string" ? rawSticker : undefined;
  const flash = onThisDay(results, date);

  return (
    <div>
      <div className="flex items-center justify-between">
        <button onPointerDown={() => setDate(addDays(date, -1))} aria-label="Previous day" className="grid h-11 w-11 place-items-center rounded-xl border-[1.5px] border-ink">‹</button>
        <h2 className="-rotate-1 bg-mustard px-2 py-0.5 font-serif font-bold">{fmt(date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</h2>
        <button onPointerDown={() => date < today && setDate(addDays(date, 1))} disabled={date >= today} aria-label="Next day" className="grid h-11 w-11 place-items-center rounded-xl border-[1.5px] border-ink disabled:opacity-30">›</button>
      </div>

      <section className="card mt-4 bg-paper-deep p-4" style={{ backgroundImage: "radial-gradient(rgba(47,43,40,.18) 1px, transparent 1px)", backgroundSize: "10px 10px" }}>
        <div className="grid grid-cols-4 gap-1.5">
          {DAILIES.map((g) => {
            const r = day[g.id];
            return (
              <div key={g.id} className={`flex-1 rounded-lg border-[1.5px] border-ink p-2 text-center ${r ? g.bg : "border-dashed bg-transparent opacity-50"}`}>
                <p className="font-pixel text-[8px] leading-tight">{g.name.toUpperCase()}</p>
                <p className="font-pixel mt-1 text-sm">{r ? (r.solved ? "✓" : "✗") : "–"}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-3 font-serif italic leading-relaxed">
          {lines.length ? lines.map((l) => <p key={l}>{l}</p>) : <p className="text-ink-soft">Nothing played yet. This page fills itself in.</p>}
        </div>

        <div className="mt-3 flex items-end gap-3">
          <label className="flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wide">Today&apos;s note</span>
            <textarea
              value={notes[date] ?? ""}
              onChange={(e) => setNote(date, e.target.value.slice(0, 280))}
              placeholder="One line about the day…"
              rows={2}
              className="mt-1 w-full resize-none border-b-[1.5px] border-ink bg-transparent font-serif italic outline-none"
            />
          </label>
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border-[1.5px] border-dashed border-ink bg-paper">
            {sticker ? (
              // eslint-disable-next-line @next/next/no-img-element -- tiny inline data URL, nothing to optimise
              <img src={sticker} alt="Today's Pixel Peek sticker" className="h-full w-full [image-rendering:pixelated]" />
            ) : (
              <span className="text-[10px] text-ink-soft">sticker</span>
            )}
          </div>
        </div>
      </section>

      <div className="mt-5 flex items-baseline justify-between">
        <h3 className="font-serif font-bold">This week</h3>
        <span className="font-pixel text-xs">{streak.current}-DAY STREAK</span>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {weekDays.map((d) => {
          const n = coreCount(results[d]);
          const frozen = streak.frozen.has(d);
          return (
            <button
              key={d}
              onPointerDown={() => d <= today && setDate(d)}
              aria-label={`${d}: ${n} of 3`}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg text-[10px] ${
                frozen ? "border-2 border-dashed border-ink bg-teal" : n === 3 ? "border-2 border-ink bg-sage" : n > 0 ? "border-2 border-ink bg-mustard" : "border-[1.5px] border-stone"
              } ${d === date ? "ring-2 ring-ink ring-offset-1 ring-offset-paper" : ""}`}
            >
              <span>{fmt(d, { weekday: "narrow" })}</span>
              <span className="font-pixel">{n || ""}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] text-ink-soft">Green: all 3 · yellow: 1–2 · blue: freeze used</p>

      {flash && (
        <div className="mt-4 rounded-xl border-[1.5px] border-ink bg-mauve p-3 text-sm">
          <span className="font-pixel mr-2 rounded border border-ink bg-paper px-1.5 py-0.5 text-[10px]">{fmt(flash.date, { day: "numeric", month: "short" }).toUpperCase()}</span>
          <b>On this day:</b> {flash.text}
        </div>
      )}
    </div>
  );
}

function CalendarView({ today }: { today: string }) {
  const results = useResults();
  const streak = computeStreak(playedDates(results), today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const first = `${month}-01`;
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
  const shift = (n: number) => {
    const d = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <button onPointerDown={() => shift(-1)} aria-label="Previous month" className="grid h-11 w-11 place-items-center rounded-xl border-[1.5px] border-ink">‹</button>
        <h2 className="font-serif text-lg font-bold">{fmt(first, { month: "long", year: "numeric" })}</h2>
        <button onPointerDown={() => shift(1)} disabled={month >= today.slice(0, 7)} aria-label="Next month" className="grid h-11 w-11 place-items-center rounded-xl border-[1.5px] border-ink disabled:opacity-30">›</button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[10px] text-ink-soft">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = `${month}-${String(i + 1).padStart(2, "0")}`;
          const n = coreCount(results[d]);
          const frozen = streak.frozen.has(d);
          return (
            <div
              key={d}
              className={`grid aspect-square place-items-center rounded-lg text-xs text-ink ${
                frozen ? "border-2 border-dashed border-ink bg-teal" : n === 3 ? "border-2 border-ink bg-sage" : n > 0 ? "border-2 border-ink bg-mustard" : "border-[1.5px] border-stone"
              } ${d === today ? "ring-2 ring-ink ring-offset-1 ring-offset-paper" : ""}`}
            >
              {i + 1}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatsView({ today }: { today: string }) {
  const results = useResults();
  const streak = computeStreak(playedDates(results), today);
  const all = Object.values(results);
  const lb = all.map((r) => r.letterbox).filter((r): r is NonNullable<typeof r> => !!r);
  const spread = [1, 2, 3, 4, 5, 6].map((n) => lb.filter((r) => r.solved && r.score === n).length);
  const max = Math.max(1, ...spread);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[["Streak", streak.current], ["Longest", streak.longest], ["Days played", playedDates(results).size]].map(([l, v]) => (
          <div key={l as string} className="card bg-paper-deep p-3">
            <p className="font-pixel text-xl">{v}</p>
            <p className="text-[11px] text-ink-soft">{l}</p>
          </div>
        ))}
      </div>

      {DAILIES.map((g) => {
        const rs = all.map((r) => r[g.id]).filter((r): r is NonNullable<typeof r> => !!r);
        const won = rs.filter((r) => r.solved).length;
        return (
          <div key={g.id} className={`card flex items-center justify-between p-3 ${g.bg}`}>
            <span className="font-serif font-bold">{g.name}</span>
            <span className="font-pixel text-xs">
              {rs.length} PLAYED · {rs.length ? Math.round((won / rs.length) * 100) : 0}% WON
            </span>
          </div>
        );
      })}

      <div>
        <h3 className="font-serif font-bold">Letterbox guess spread</h3>
        <div className="mt-2 flex flex-col gap-1">
          {spread.map((n, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="font-pixel w-3">{i + 1}</span>
              <div className="h-4 rounded-sm border border-ink bg-terracotta" style={{ width: `${Math.max(4, (n / max) * 100)}%`, opacity: n ? 1 : 0.3 }} />
              <span>{n || ""}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Journal({ today }: { today: string }) {
  const [tab, setTab] = useState<Tab>("Page");
  return (
    <div className="px-4 pt-5">
      <h1 className="font-serif text-3xl font-bold">Journal</h1>
      <div role="tablist" className="mt-3 grid grid-cols-3 overflow-hidden rounded-xl border-[1.5px] border-ink">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onPointerDown={() => setTab(t)}
            className={`min-h-11 text-sm font-bold ${tab === t ? "bg-ink text-paper" : ""}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-4 pb-4">
        {tab === "Page" && <PageView today={today} />}
        {tab === "Calendar" && <CalendarView today={today} />}
        {tab === "Stats" && <StatsView today={today} />}
      </div>
    </div>
  );
}
