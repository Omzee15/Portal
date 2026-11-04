"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { recordResult } from "@/lib/store";
import { copyText } from "@/lib/browser";

type Saved = {
  clues: { clue: string; length?: number }[];
  tiles: string[];
  /** clue index -> the answer and the tile indices it consumed */
  solved: Record<number, { answer: string; used: number[] }>;
  mistakes: number;
  done: boolean;
};

const safeGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

export function Wordsplice({ puzzle, date }: { puzzle: number; date: string }) {
  const key = `portal:splice:${puzzle}`;
  const [s, setS] = useState<Saved | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [toast, setToast] = useState<string>();
  const [shared, setShared] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flash = (m: string) => {
    setToast(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(undefined), 1700);
  };

  useEffect(() => {
    const raw = safeGet(key);
    if (raw) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring saved state; localStorage is unavailable during SSR
        setS(JSON.parse(raw) as Saved);
        return;
      } catch {
        /* fresh load */
      }
    }
    fetch("/api/splice/puzzle")
      .then((r) => r.json())
      .then((d: { clues: Saved["clues"]; tiles: string[] }) => setS({ clues: d.clues, tiles: d.tiles, solved: {}, mistakes: 0, done: false }))
      .catch(() => flash("Couldn't load today's puzzle. Check your signal."));
  }, [key]);

  if (!s) return <p className="p-6 text-center text-sm text-ink-soft">{toast ?? "Loading…"}</p>;

  const usedTiles = new Set(Object.values(s.solved).flatMap((v) => v.used));
  const word = picked.map((i) => s.tiles[i]).join("");
  const solvedCount = Object.keys(s.solved).length;

  const submit = async () => {
    if (busy || picked.length < 2 || s.done) return;
    setBusy(true);
    try {
      const res = await fetch("/api/splice/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tiles: picked.map((i) => s.tiles[i]), solved: Object.keys(s.solved).map(Number) }),
      });
      const d = (await res.json()) as { correct: boolean; clue?: number; answer?: string };
      if (d.correct && d.clue !== undefined && d.answer) {
        const solved = { ...s.solved, [d.clue]: { answer: d.answer, used: picked } };
        const done = Object.keys(solved).length === s.clues.length;
        const next: Saved = { ...s, solved, done };
        setS(next);
        safeSet(key, JSON.stringify(next));
        setPicked([]);
        navigator.vibrate?.(20);
        flash(`${d.answer.toUpperCase()}: matches a clue`);
        if (done) {
          recordResult(date, "wordsplice", { puzzle, solved: true, score: next.mistakes, grid: `${next.mistakes} wrong tries` });
          navigator.vibrate?.([20, 40, 20]);
        }
      } else {
        const next = { ...s, mistakes: s.mistakes + 1 };
        setS(next);
        safeSet(key, JSON.stringify(next));
        setShake(true);
        setTimeout(() => setShake(false), 280);
        navigator.vibrate?.(40);
        flash("Doesn't match any clue");
        setPicked([]);
      }
    } catch {
      flash("No signal. Your pieces are kept, try again.");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const msg = `Wordsplice ${puzzle} · ${s.mistakes === 0 ? "no wrong tries" : `${s.mistakes} wrong ${s.mistakes === 1 ? "try" : "tries"}`}\n${"🟩".repeat(7)}`;
    try {
      if (navigator.share) await navigator.share({ text: msg });
      else {
        await copyText(msg);
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      }
    } catch {
      /* dismissed */
    }
  };

  return (
    <div className="flex flex-col px-4 pb-4">
      <div className="relative mt-2 h-6 shrink-0 text-center">
        {toast && (
          <span role="status" className="absolute left-1/2 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper">
            {toast}
          </span>
        )}
      </div>
      <p className="text-center text-xs text-ink-soft">
        Join the pieces to answer each clue. Some pieces are decoys. {solvedCount} of {s.clues.length} found · {s.mistakes} wrong {s.mistakes === 1 ? "try" : "tries"}
      </p>

      {/* The clues scroll on their own so the pieces and buttons always stay on screen. */}
      <ol className="mt-2 flex min-h-20 flex-1 flex-col gap-1.5 overflow-y-auto">
        {s.clues.map((c, i) => {
          const hit = s.solved[i];
          return (
            <li key={i} className={`flex shrink-0 items-center justify-between gap-2 rounded-xl border-[1.5px] px-3 py-2 text-sm ${hit ? "pop-in border-ink bg-sage" : "border-dashed border-ink-soft"}`}>
              <span>{c.clue}</span>
              <span className="font-pixel shrink-0 text-[11px] uppercase">{hit ? hit.answer : c.length ? `${c.length} letters` : "?"}</span>
            </li>
          );
        })}
      </ol>

      {!s.done ? (
        <div className="shrink-0 pt-3 [@media(max-height:700px)]:pt-1.5">
          <div
            className={`flex min-h-12 flex-wrap items-center gap-1.5 rounded-xl border-[1.5px] border-ink bg-paper-deep p-2 ${shake ? "row-shake" : ""}`}
            aria-label="Your word"
          >
            {picked.length === 0 && <span className="text-sm text-ink-soft">Tap pieces to build an answer…</span>}
            {picked.map((ti, k) => (
              <button
                key={k}
                onPointerDown={() => setPicked((p) => p.filter((_, j) => j !== k))}
                aria-label={`Remove ${s.tiles[ti]}`}
                className="font-pixel rounded-lg border-[1.5px] border-ink bg-mustard px-2.5 py-2 text-base uppercase"
              >
                {s.tiles[ti]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-center font-pixel text-xs uppercase text-ink-soft">{word ? `${word} · ${word.length}` : " "}</p>

          <div className="mt-1 flex flex-wrap justify-center gap-1.5 [@media(max-height:700px)]:gap-1" role="group" aria-label="Pieces">
            {s.tiles.map((t, i) =>
              usedTiles.has(i) || picked.includes(i) ? null : (
                <button
                  key={i}
                  onPointerDown={() => setPicked((p) => [...p, i])}
                  className="font-pixel min-h-11 rounded-lg border-[1.5px] border-ink bg-paper px-3 text-base uppercase active:scale-[0.94] [@media(max-height:700px)]:min-h-9 [@media(max-height:700px)]:px-2.5 [@media(max-height:700px)]:text-sm"
                >
                  {t}
                </button>
              ),
            )}
          </div>

          <div className="mt-3 flex gap-2 [@media(max-height:700px)]:mt-2">
            <button onPointerDown={() => setPicked([])} disabled={!picked.length} className="h-12 flex-1 rounded-full border-[1.5px] border-ink font-bold disabled:opacity-40 active:scale-[0.97]">
              Clear
            </button>
            <button onPointerDown={submit} disabled={picked.length < 2 || busy} className="h-12 flex-[1.5] rounded-full border-[1.5px] border-ink bg-ink font-bold text-paper disabled:opacity-40 active:scale-[0.97]">
              Submit
            </button>
          </div>
        </div>
      ) : (
        <section className="card mt-5 bg-paper-deep p-4 text-center">
          <h2 className="font-serif text-2xl font-bold">{s.mistakes === 0 ? "Clean splice" : "All 7 found"}</h2>
          <p className="mt-1 text-sm text-ink-soft">{s.mistakes === 0 ? "No wrong tries" : `${s.mistakes} wrong ${s.mistakes === 1 ? "try" : "tries"}`}</p>
          <button onPointerDown={share} className="mt-3 h-12 w-full rounded-full border-[1.5px] border-ink bg-ink font-bold text-paper active:scale-[0.97]">
            {shared ? "Copied" : "Share result"}
          </button>
          <Link href="/" className="mt-2 block py-2 text-sm underline">
            Back to Today
          </Link>
        </section>
      )}
    </div>
  );
}
