"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { recordResult } from "@/lib/store";
import { copyText, randomId } from "@/lib/browser";

type Saved = {
  rounds: string[][];
  answers: { pick: string; correct: boolean; odd: string; why: string }[];
  done: boolean;
  /** epoch ms when the clock runs out; saved so a reload can't reset or end the clock */
  deadline: number;
};
const SECONDS = 90;
type Resp = { correct: boolean; odd: string; why: string; finished: boolean };

/** Wall-clock check kept out of component bodies (it is an event-time read, not a render-time one). */
const timeUp = (deadline: number) => Date.now() >= deadline;

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
    /* ignore */
  }
}

export function OddOne({ puzzle, date }: { puzzle: number; date: string }) {
  const key = `portal:odd:${puzzle}`;
  const [s, setS] = useState<Saved | null>(null);
  const [left, setLeft] = useState(SECONDS);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string>();
  const [shared, setShared] = useState(false);
  const pending = useRef<{ r: number; p: string; id: string } | null>(null);

  useEffect(() => {
    const raw = safeGet(key);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as Saved;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring saved state; localStorage is unavailable during SSR
        setS({ ...saved, deadline: saved.deadline ?? Date.now() + SECONDS * 1000 });
        return;
      } catch {
        /* fresh */
      }
    }
    fetch("/api/odd/puzzle")
      .then((r) => r.json())
      .then((d: { rounds: string[][] }) => {
        const fresh: Saved = { rounds: d.rounds, answers: [], done: false, deadline: Date.now() + SECONDS * 1000 };
        safeSet(key, JSON.stringify(fresh));
        setS(fresh);
      })
      .catch(() => setToast("Couldn't load. Check your signal."));
  }, [key]);

  const finish = (next: Saved) => {
    const correct = next.answers.filter((a) => a.correct).length;
    recordResult(date, "odd-one", {
      puzzle,
      solved: correct === 3,
      score: correct,
      grid: Array.from({ length: 3 }, (_, i) => (next.answers[i]?.correct ? "🟩" : "🟥")).join(""),
    });
  };

  // The clock; unanswered rounds count as missed.
  useEffect(() => {
    if (!s || s.done) return;
    const t = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((s.deadline - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        const next = { ...s, done: true };
        setS(next);
        safeSet(key, JSON.stringify(next));
        finish(next);
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, key]);

  if (!s) return <p className="p-6 text-center text-sm text-ink-soft">{toast ?? "Loading…"}</p>;

  const round = s.answers.length;
  const score = s.answers.filter((a) => a.correct).length;

  const answer = async (pick: string) => {
    if (busy || s.done || timeUp(s.deadline)) return;
    if (pending.current?.r !== round || pending.current.p !== pick) {
      pending.current = { r: round, p: pick, id: randomId() };
    }
    setBusy(true);
    try {
      const res = await fetch("/api/odd/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round, pick, clientActionId: pending.current.id }),
      });
      if (!res.ok) return setToast("Something went wrong. Try again.");
      const d = (await res.json()) as Resp;
      pending.current = null;
      navigator.vibrate?.(d.correct ? 20 : 40);
      const next: Saved = { ...s, answers: [...s.answers, { pick, correct: d.correct, odd: d.odd, why: d.why }],
        // time may have run out while the request was in flight
        done: d.finished || timeUp(s.deadline),
      };
      setS(next);
      safeSet(key, JSON.stringify(next));
      if (next.done) finish(next);
    } catch {
      setToast("No signal. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const text = `Odd One ${puzzle} ${score}/3\n\n${Array.from({ length: 3 }, (_, i) => (s.answers[i]?.correct ? "🟩" : "🟥")).join("")}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await copyText(text);
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      }
    } catch {
      /* dismissed */
    }
  };

  const last = s.answers[s.answers.length - 1];

  return (
    <div className="flex flex-col px-4 pb-5">
      {!s.done ? (
        <>
          <div className="mt-4 flex items-center justify-between">
            <span className="font-pixel text-xs">ROUND {round + 1}/3</span>
            <span className={`font-pixel text-lg ${left <= 10 ? "text-brick" : ""}`} aria-live="off">{left}s</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full border border-ink">
            <div className="h-full bg-sage" style={{ width: `${(left / SECONDS) * 100}%`, transition: "width 1s linear" }} />
          </div>
          <h2 className="mt-5 text-center font-serif text-xl font-bold [@media(max-height:700px)]:mt-3">Which one doesn&apos;t belong?</h2>
          {last && (
            <p className={`mt-2 text-center text-xs ${last.correct ? "text-ink" : "text-brick"}`}>
              {last.correct ? "Correct: " : `It was ${last.odd}: `}
              {last.why}
            </p>
          )}
          {/* The five answers share the height that's left: roomy on tall screens, still tappable on short ones. */}
          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 [@media(max-height:700px)]:mt-3">
            {s.rounds[round].map((it) => (
              <button
                key={it}
                onPointerDown={() => answer(it)}
                disabled={busy}
                className="card min-h-11 max-h-20 flex-1 bg-paper-deep text-lg font-bold capitalize active:translate-x-px active:translate-y-px active:shadow-[2px_2px_0_var(--ink)]"
              >
                {it}
              </button>
            ))}
          </div>
        </>
      ) : (
        <section className="card mt-6 bg-paper-deep p-4 text-center">
          <h2 className="font-serif text-2xl font-bold">{score === 3 ? "Clean sweep" : `${score} of 3`}</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {[0, 1, 2].map((i) => {
              const a = s.answers[i];
              return (
                <li key={i}>
                  {a ? (a.correct ? "🟩" : "🟥") : "⬜"} {a ? `${a.odd}: ${a.why}` : "Out of time"}
                </li>
              );
            })}
          </ul>
          <button onPointerDown={share} className="mt-4 h-12 w-full rounded-full border-[1.5px] border-ink bg-ink font-bold text-paper active:scale-[0.97]">
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
