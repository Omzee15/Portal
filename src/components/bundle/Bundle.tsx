"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { recordResult } from "@/lib/store";

type Color = "mustard" | "sage" | "teal" | "mauve";
type Group = { title: string; color: Color; words: string[] };
type Saved = {
  words: string[];
  found: Group[];
  mistakes: number;
  tried: string[];
  guesses: string[][];
  lost: boolean;
  solution?: Group[];
};
type GuessResponse = {
  correct: boolean;
  group?: Group;
  oneAway: boolean;
  mistakes: number;
  lost: boolean;
  groups?: Group[];
};

const BG: Record<Color, string> = {
  mustard: "bg-mustard",
  sage: "bg-sage",
  teal: "bg-teal",
  mauve: "bg-mauve",
};
const EMOJI: Record<Color, string> = { mustard: "🟨", sage: "🟩", teal: "🟦", mauve: "🟪" };
const MAX = 4;

function safeGet(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* keep playing without persistence */
  }
}

export function Bundle({ puzzle, date }: { puzzle: number; date: string }) {
  const key = `pastime:bundle:${puzzle}`;
  const [state, setState] = useState<Saved | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string>();
  const [shake, setShake] = useState(false);
  const [shared, setShared] = useState(false);
  const pending = useRef<{ k: string; id: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flash = useCallback((m: string) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(undefined), 1600);
  }, []);

  useEffect(() => {
    const raw = safeGet(key);
    if (raw) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring saved state; localStorage is unavailable during SSR
        setState(JSON.parse(raw) as Saved);
        return;
      } catch {
        /* fall through to a fresh load */
      }
    }
    fetch("/api/bundle/puzzle")
      .then((r) => r.json())
      .then((d: { words: string[] }) =>
        setState({ words: d.words, found: [], mistakes: 0, tried: [], guesses: [], lost: false }),
      )
      .catch(() => flash("Couldn't load today's puzzle. Check your signal."));
  }, [key, flash]);

  const persist = (s: Saved) => {
    setState(s);
    safeSet(key, JSON.stringify(s));
  };

  if (!state) {
    return <p className="p-6 text-center text-sm text-ink-soft">Loading…</p>;
  }

  const won = state.found.length === 4;
  const finished = won || state.lost;
  const foundWords = new Set(state.found.flatMap((g) => g.words));
  const remaining = state.words.filter((w) => !foundWords.has(w));

  const finish = (s: Saved, solution: Group[]) => {
    const color = new Map<string, Color>();
    solution.forEach((g) => g.words.forEach((w) => color.set(w, g.color)));
    const grid = s.guesses.map((g) => g.map((w) => EMOJI[color.get(w) ?? "mustard"]).join("")).join("\n");
    recordResult(date, "bundle", { puzzle, solved: !s.lost, score: s.mistakes, grid });
  };

  const toggle = (w: string) => {
    if (finished || busy) return;
    setSelected((cur) => (cur.includes(w) ? cur.filter((x) => x !== w) : cur.length < 4 ? [...cur, w] : cur));
  };

  const submit = async () => {
    if (busy || finished || selected.length !== 4) return;
    const sig = [...selected].sort().join(",");
    if (state.tried.includes(sig)) return flash("Already guessed");
    if (pending.current?.k !== sig) {
      pending.current = { k: sig, id: crypto.randomUUID().replace(/-/g, "") };
    }
    setBusy(true);
    try {
      const res = await fetch("/api/bundle/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: selected, clientActionId: pending.current.id }),
      });
      if (!res.ok) return flash("Something went wrong. Try again.");
      const d = (await res.json()) as GuessResponse;
      pending.current = null;

      const next: Saved = {
        ...state,
        mistakes: d.mistakes,
        tried: [...state.tried, sig],
        guesses: [...state.guesses, selected],
        found: d.correct && d.group ? [...state.found, d.group] : state.found,
        lost: d.lost,
        solution: d.groups,
      };
      if (d.correct) {
        setSelected([]);
        navigator.vibrate?.(20);
      } else {
        setShake(true);
        setTimeout(() => setShake(false), 280);
        navigator.vibrate?.(40);
        flash(d.oneAway ? "One away…" : d.lost ? "Out of mistakes" : "Not a group");
        if (d.lost) setSelected([]);
      }
      persist(next);
      if (next.found.length === 4) finish(next, next.found);
      else if (d.lost && d.groups) finish(next, d.groups);
    } catch {
      flash("No signal. Your selection is kept, try again.");
    } finally {
      setBusy(false);
    }
  };

  const shuffle = () => {
    if (finished) return;
    persist({ ...state, words: [...state.found.flatMap((g) => g.words), ...[...remaining].sort(() => Math.random() - 0.5)] });
  };

  const share = async () => {
    const color = new Map<string, Color>();
    (state.solution ?? state.found).forEach((g) => g.words.forEach((w) => color.set(w, g.color)));
    const grid = state.guesses.map((g) => g.map((w) => EMOJI[color.get(w) ?? "mustard"]).join("")).join("\n");
    const text = `Bundle ${puzzle} ${state.lost ? "X" : `${state.mistakes} slip${state.mistakes === 1 ? "" : "s"}`}\n\n${grid}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      }
    } catch {
      /* dismissed */
    }
  };

  const revealed = state.lost ? (state.solution ?? []).filter((g) => !state.found.some((f) => f.title === g.title)) : [];

  return (
    <div className="flex min-h-[calc(100dvh-56px)] md:min-h-[640px] flex-col px-4 pb-5">
      <div className="relative mt-3 h-6 text-center">
        {toast && (
          <span role="status" className="absolute left-1/2 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper">
            {toast}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {[...state.found, ...revealed].map((g) => (
          <div key={g.title} className={`card pop-in ${BG[g.color]} px-3 py-3 text-center`}>
            <p className="text-sm font-bold uppercase tracking-wide">{g.title}</p>
            <p className="text-sm capitalize">{g.words.join(", ")}</p>
          </div>
        ))}
      </div>

      {!finished && (
        <div className={`mt-2 grid grid-cols-4 gap-2 ${shake ? "row-shake" : ""}`} role="group" aria-label="Words">
          {remaining.map((w) => {
            const on = selected.includes(w);
            return (
              <button
                key={w}
                onPointerDown={() => toggle(w)}
                aria-pressed={on}
                className={`min-h-16 rounded-xl border-[1.5px] border-ink px-1 text-[13px] font-bold uppercase leading-tight transition-transform active:scale-[0.94] ${
                  on ? "scale-[0.97] bg-ink text-paper" : "bg-paper-deep"
                }`}
              >
                {w}
              </button>
            );
          })}
        </div>
      )}

      {!finished && (
        <>
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-soft">
            Mistakes left
            {Array.from({ length: MAX }, (_, i) => (
              <span
                key={i}
                className={`h-3 w-3 rounded-full border-[1.5px] border-ink ${i < MAX - state.mistakes ? "bg-brick" : "bg-transparent"}`}
              />
            ))}
          </p>
          <div className="mt-3 flex gap-2">
            <button onPointerDown={shuffle} className="h-12 flex-1 rounded-full border-[1.5px] border-ink font-bold active:scale-[0.97]">
              Shuffle
            </button>
            <button
              onPointerDown={() => setSelected([])}
              disabled={!selected.length}
              className="h-12 flex-1 rounded-full border-[1.5px] border-ink font-bold disabled:opacity-40 active:scale-[0.97]"
            >
              Clear
            </button>
            <button
              onPointerDown={submit}
              disabled={selected.length !== 4 || busy}
              className="h-12 flex-[1.4] rounded-full border-[1.5px] border-ink bg-ink font-bold text-paper disabled:opacity-40 active:scale-[0.97]"
            >
              Submit
            </button>
          </div>
        </>
      )}

      {finished && (
        <section className="card mt-4 bg-paper-deep p-4 text-center">
          <h2 className="font-serif text-2xl font-bold">
            {won ? (state.mistakes === 0 ? "Perfect Bundle" : `Solved with ${state.mistakes} slip${state.mistakes === 1 ? "" : "s"}`) : "Not this time"}
          </h2>
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
