"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { boxOf, colOf, conflicts, rowOf, toGrid } from "@/lib/sudoku/engine";
import { recordResult } from "@/lib/store";
import { TIER_STYLE } from "@/lib/tier-style";
import type { Tier } from "@/lib/schedule";

type Saved = {
  givens: string;
  vals: string; // 81 digits, 0 = empty
  notes: number[]; // bitmask per cell, bits 1..9
  tier: Tier;
  startedAt: number;
  doneAt?: number;
  checks: number;
  wrong: number[];
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

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

export function Sudoku({ puzzle, date }: { puzzle: number; date: string }) {
  const key = `portal:sudoku:${puzzle}`;
  const [s, setS] = useState<Saved | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [now, setNow] = useState(0);
  const [toast, setToast] = useState<string>();
  const [shared, setShared] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flash = useCallback((m: string) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(undefined), 1700);
  }, []);

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
    fetch("/api/sudoku/puzzle")
      .then((r) => r.json())
      .then((d: { givens: string; tier: Saved["tier"] }) => {
        const fresh: Saved = { givens: d.givens, vals: d.givens, notes: new Array(81).fill(0), tier: d.tier, startedAt: Date.now(), checks: 0, wrong: [] };
        safeSet(key, JSON.stringify(fresh));
        setS(fresh);
      })
      .catch(() => flash("Couldn't load today's puzzle. Check your signal."));
  }, [key, flash]);

  // one-second clock while the puzzle is open
  useEffect(() => {
    if (!s || s.doneAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [s]);

  const persist = useCallback(
    (n: Saved) => {
      setS(n);
      safeSet(key, JSON.stringify(n));
    },
    [key],
  );

  const verify = useCallback(
    async (n: Saved, manual: boolean) => {
      try {
        const res = await fetch("/api/sudoku/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grid: n.vals }),
        });
        const d = (await res.json()) as { solved: boolean; wrong: number[] };
        const next: Saved = { ...n, checks: n.checks + (manual ? 1 : 0), wrong: d.wrong };
        if (d.solved) {
          next.doneAt = Date.now();
          persist(next);
          recordResult(date, "sudoku", { puzzle, solved: true, score: Math.round((next.doneAt - n.startedAt) / 1000), grid: `${n.tier} · ${next.checks} checks` });
          navigator.vibrate?.([20, 40, 20]);
        } else {
          persist(next);
          flash(d.wrong.length ? `${d.wrong.length} cell${d.wrong.length > 1 ? "s are" : " is"} wrong` : "Looking good so far");
        }
      } catch {
        flash("No signal. Try again.");
      }
    },
    [date, flash, persist, puzzle],
  );

  const enter = useCallback(
    (digit: number) => {
      if (!s || s.doneAt || sel === null || s.givens[sel] !== "0") return;
      const vals = [...s.vals];
      const notes = [...s.notes];
      if (noteMode && digit) {
        notes[sel] ^= 1 << digit;
        vals[sel] = "0";
      } else {
        vals[sel] = String(digit);
        notes[sel] = 0;
        // placing a digit clears matching notes in its row, column and box
        if (digit)
          for (let i = 0; i < 81; i++)
            if (rowOf(i) === rowOf(sel) || colOf(i) === colOf(sel) || boxOf(i) === boxOf(sel)) notes[i] &= ~(1 << digit);
      }
      const next: Saved = { ...s, vals: vals.join(""), notes, wrong: s.wrong.filter((w) => w !== sel) };
      persist(next);
      // a finished, rule-abiding grid is checked automatically
      if (!next.vals.includes("0") && !conflicts(toGrid(next.vals)).some(Boolean)) void verify(next, false);
    },
    [s, sel, noteMode, persist, verify],
  );

  // physical keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key)) return enter(Number(e.key));
      if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") return enter(0);
      if (e.key.toLowerCase() === "n") return setNoteMode((m) => !m);
      const move: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 };
      if (e.key in move) {
        e.preventDefault();
        setSel((c) => {
          const cur = c ?? 40;
          const n = cur + move[e.key];
          if (n < 0 || n > 80) return cur;
          if (Math.abs(move[e.key]) === 1 && rowOf(n) !== rowOf(cur)) return cur;
          return n;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enter]);

  if (!s) return <p className="p-6 text-center text-sm text-ink-soft">{toast ?? "Loading…"}</p>;

  const grid = toGrid(s.vals);
  const bad = conflicts(grid);
  const selVal = sel !== null ? grid[sel] : 0;
  const counts = new Array(10).fill(0);
  grid.forEach((v) => counts[v]++);
  const elapsed = Math.max(0, Math.round(((s.doneAt ?? (now || s.startedAt)) - s.startedAt) / 1000));

  const share = async () => {
    const msg = `Sudoku ${puzzle} (${s.tier}) · ${mmss(elapsed)}${s.checks ? ` · ${s.checks} check${s.checks > 1 ? "s" : ""}` : ""}`;
    try {
      if (navigator.share) await navigator.share({ text: msg });
      else {
        await navigator.clipboard.writeText(msg);
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      }
    } catch {
      /* dismissed */
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-56px)] md:min-h-[640px] flex-col px-3 pb-4">
      <div className="relative mt-2 flex h-8 items-center justify-between px-1 text-sm">
        <span className={`font-pixel rounded px-1.5 py-0.5 text-[10px] uppercase ${TIER_STYLE[s.tier]}`}>{s.tier}</span>
        {toast && (
          <span role="status" className="absolute left-1/2 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper">
            {toast}
          </span>
        )}
        <span className="font-pixel">{mmss(elapsed)}</span>
      </div>

      <div className="mx-auto mt-1 w-full max-w-[380px] overflow-hidden rounded-xl border-2 border-ink bg-paper" role="grid" aria-label="Sudoku grid">
        {Array.from({ length: 9 }, (_, r) => (
          <div key={r} role="row" className="grid grid-cols-9">
            {grid.slice(r * 9, r * 9 + 9).map((v, c) => {
          const i = r * 9 + c;
          const given = s.givens[i] !== "0";
          const isSel = sel === i;
          const related = sel !== null && (rowOf(i) === rowOf(sel) || colOf(i) === colOf(sel) || boxOf(i) === boxOf(sel));
          const same = selVal !== 0 && v === selVal;
          const isWrong = s.wrong.includes(i);
          return (
            <button
              key={i}
              role="gridcell"
              aria-label={`Row ${rowOf(i) + 1} column ${colOf(i) + 1}${v ? `, ${v}` : ", empty"}`}
              onPointerDown={() => setSel(i)}
              className={`relative grid aspect-square place-items-center border-stone text-xl ${
                colOf(i) % 3 === 2 && colOf(i) !== 8 ? "border-r-2 border-r-ink" : "border-r"
              } ${rowOf(i) % 3 === 2 && rowOf(i) !== 8 ? "border-b-2 border-b-ink" : "border-b"} ${
                isSel ? "bg-mustard" : same ? "bg-sage/70" : related ? "bg-paper-deep" : ""
              } ${given ? "font-bold" : "font-medium text-ink-soft"} ${bad[i] || isWrong ? "text-brick underline decoration-2" : ""}`}
            >
              {v ? (
                <span className="font-pixel">{v}</span>
              ) : s.notes[i] ? (
                <span className="grid h-full w-full grid-cols-3 p-px text-[8px] leading-none text-ink-soft">
                  {Array.from({ length: 9 }, (_, k) => (
                    <span key={k} className="grid place-items-center">
                      {s.notes[i] & (1 << (k + 1)) ? k + 1 : ""}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          );
            })}
          </div>
        ))}
      </div>

      {s.doneAt ? (
        <section className="card mx-auto mt-4 w-full max-w-[380px] bg-paper-deep p-4 text-center">
          <h2 className="font-serif text-2xl font-bold">Solved in {mmss(elapsed)}</h2>
          <p className="mt-1 text-sm text-ink-soft">{s.checks === 0 ? "No checks used" : `${s.checks} check${s.checks > 1 ? "s" : ""} used`}</p>
          <button onPointerDown={share} className="mt-3 h-12 w-full rounded-full border-[1.5px] border-ink bg-ink font-bold text-paper active:scale-[0.97]">
            {shared ? "Copied" : "Share result"}
          </button>
          <Link href="/" className="mt-2 block py-2 text-sm underline">
            Back to Today
          </Link>
        </section>
      ) : (
        <div className="mx-auto mt-3 w-full max-w-[380px]">
          <div className="grid grid-cols-9 gap-1">
            {Array.from({ length: 9 }, (_, k) => k + 1).map((d) => (
              <button
                key={d}
                onPointerDown={() => enter(d)}
                disabled={counts[d] >= 9 && !noteMode}
                className="font-pixel h-12 rounded-lg border-[1.5px] border-ink bg-paper text-lg active:scale-[0.94] disabled:opacity-30"
              >
                {d}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button onPointerDown={() => enter(0)} className="h-11 rounded-full border-[1.5px] border-ink font-bold active:scale-[0.97]">
              Erase
            </button>
            <button
              onPointerDown={() => setNoteMode((m) => !m)}
              aria-pressed={noteMode}
              className={`h-11 rounded-full border-[1.5px] border-ink font-bold active:scale-[0.97] ${noteMode ? "bg-ink text-paper" : ""}`}
            >
              Notes {noteMode ? "on" : "off"}
            </button>
            <button onPointerDown={() => void verify(s, true)} className="h-11 rounded-full border-[1.5px] border-ink bg-mustard font-bold active:scale-[0.97]">
              Check
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-ink-soft">Tap a cell, then a number. Keyboard: 1–9, arrows, N for notes.</p>
        </div>
      )}
    </div>
  );
}
