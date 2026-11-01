"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { recordResult } from "@/lib/store";
import { TIER_STYLE } from "@/lib/tier-style";
import type { Tier } from "@/lib/schedule";

type Saved = {
  start: string;
  target: string;
  tier: Tier;
  chain: string[];
  done: boolean;
  solved: boolean;
  par?: number;
  example?: string[];
};

const MAX_STEPS = 20;
const REASONS: Record<string, string> = {
  not_a_word: "Not a word",
  not_one_letter: "Change exactly one letter",
  bad_word: "Four letters, please",
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

/** Highlights the letter that changed from the previous word. */
function Word({ w, prev, hot }: { w: string; prev?: string; hot?: boolean }) {
  return (
    <span className="flex gap-1.5">
      {[...w].map((c, i) => (
        <span
          key={i}
          className={`font-pixel grid h-12 w-12 place-items-center rounded-xl border-[1.5px] border-ink text-xl uppercase ${
            hot ? "bg-mustard" : prev && prev[i] !== c ? "bg-sage" : "bg-paper-deep"
          }`}
        >
          {c}
        </span>
      ))}
    </span>
  );
}

export function WordLadder({ puzzle, date }: { puzzle: number; date: string }) {
  const key = `portal:ladder:${puzzle}`;
  const [s, setS] = useState<Saved | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
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
    fetch("/api/ladder/puzzle")
      .then((r) => r.json())
      .then((d: { start: string; target: string; tier: Saved["tier"] }) =>
        setS({ start: d.start, target: d.target, tier: d.tier, chain: [d.start], done: false, solved: false }),
      )
      .catch(() => flash("Couldn't load today's ladder. Check your signal."));
  }, [key]);

  if (!s) return <p className="p-6 text-center text-sm text-ink-soft">{toast ?? "Loading…"}</p>;

  const steps = s.chain.length - 1;
  const persist = (n: Saved) => {
    setS(n);
    safeSet(key, JSON.stringify(n));
  };
  const finish = (n: Saved) => {
    recordResult(date, "word-ladder", { puzzle, solved: n.solved, score: n.chain.length - 1, grid: `Par ${n.par} · ${n.chain.length - 1} steps` });
  };

  const submit = async () => {
    const to = text.trim().toLowerCase();
    if (!to || busy || s.done) return;
    const from = s.chain[s.chain.length - 1];
    if (s.chain.includes(to)) return flash("Already on your ladder");
    setBusy(true);
    try {
      const res = await fetch("/api/ladder/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const d = await res.json();
      if (!res.ok) {
        navigator.vibrate?.(40);
        return flash(REASONS[d.error] ?? "Try another word");
      }
      const next: Saved = { ...s, chain: [...s.chain, to], done: d.reached || s.chain.length >= MAX_STEPS, solved: !!d.reached, par: d.par, example: d.example };
      setText("");
      persist(next);
      if (next.done) {
        if (!next.solved) {
          const g = await fetch("/api/ladder/giveup", { method: "POST" }).then((r) => r.json());
          next.par = g.par;
          next.example = g.example;
          persist({ ...next });
        }
        finish(next);
        navigator.vibrate?.(next.solved ? [20, 40, 20] : 60);
      }
    } catch {
      flash("No signal. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const undo = () => {
    if (s.done || s.chain.length < 2) return;
    persist({ ...s, chain: s.chain.slice(0, -1) });
  };

  const giveUp = async () => {
    if (s.done) return;
    try {
      const g = await fetch("/api/ladder/giveup", { method: "POST" }).then((r) => r.json());
      const next: Saved = { ...s, done: true, solved: false, par: g.par, example: g.example };
      persist(next);
      finish(next);
    } catch {
      flash("No signal. Try again.");
    }
  };

  const share = async () => {
    const msg = `Word Ladder ${puzzle} · ${s.solved ? `${steps} steps (par ${s.par})` : "gave up"}\n${s.chain.map((w) => (w === s.start || w === s.target ? w.toUpperCase() : "▪▪▪▪")).join(" → ")}`;
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

  const last = s.chain[s.chain.length - 1];

  return (
    <div className="flex min-h-[calc(100dvh-56px)] md:min-h-[640px] flex-col px-4 pb-5">
      <div className="relative mt-3 h-6 text-center">
        {toast && (
          <span role="status" className="absolute left-1/2 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper">
            {toast}
          </span>
        )}
      </div>

      <p className="text-center text-sm">
        Turn <b className="uppercase">{s.start}</b> into <b className="uppercase">{s.target}</b>, changing one letter each step.
      </p>
      <p className="mt-1 flex items-center justify-center gap-2 text-xs text-ink-soft">
        <span className={`font-pixel rounded px-1.5 py-0.5 text-[10px] uppercase ${TIER_STYLE[s.tier]}`}>{s.tier}</span>
        {steps} step{steps === 1 ? "" : "s"} so far
      </p>

      <ol className="mt-4 flex flex-col items-center gap-2" aria-label="Your ladder">
        {s.chain.map((w, i) => (
          <li key={w}>
            <Word w={w} prev={s.chain[i - 1]} hot={i === 0} />
          </li>
        ))}
        {!s.done && (
          <li aria-hidden className="flex flex-col items-center gap-2 opacity-60">
            <span className="text-ink-soft">↓</span>
            <Word w={s.target} />
          </li>
        )}
      </ol>

      {!s.done ? (
        <div className="mt-auto pt-5">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value.toLowerCase().replace(/[^a-z]/g, "").slice(0, 4))}
              placeholder={`Next word after ${last.toUpperCase()}`}
              aria-label="Next word"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              className="font-pixel h-12 min-w-0 flex-1 rounded-xl border-[1.5px] border-ink bg-paper px-3 uppercase placeholder:font-sans placeholder:normal-case placeholder:text-sm"
            />
            <button disabled={busy || text.length !== 4} className="h-12 rounded-full border-[1.5px] border-ink bg-ink px-6 font-bold text-paper disabled:opacity-40 active:scale-[0.97]">
              Add
            </button>
          </form>
          <div className="mt-2 flex justify-between text-sm">
            <button onPointerDown={undo} disabled={steps === 0} className="min-h-11 px-3 underline disabled:opacity-40">
              Undo last
            </button>
            <button onPointerDown={giveUp} className="min-h-11 px-3 underline">
              Give up
            </button>
          </div>
        </div>
      ) : (
        <section className="card mt-5 bg-paper-deep p-4 text-center">
          <h2 className="font-serif text-2xl font-bold">
            {s.solved ? (steps <= (s.par ?? 99) ? "At par or better" : `${steps} steps`) : "Not this time"}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Par is {s.par}. One route: <b className="uppercase">{s.example?.join(" → ")}</b>
          </p>
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
