"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { recordResult } from "@/lib/store";
import {
  isSolved,
  keyboardStates,
  MAX_GUESSES,
  WORD_LENGTH,
  type TileState,
} from "@/lib/letterbox/scoring";

type Row = { guess: string; feedback: TileState[] };
type Saved = { rows: Row[]; answer?: string; solved: boolean };
type GuessResponse = {
  step: number;
  feedback: TileState[];
  solved: boolean;
  answer?: string;
};

const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const WORDS_KEY = "pastime:letterbox:words:v3";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota: the game still works, it just won't resume */
  }
}

function newActionId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function Letterbox({ puzzle, date }: { puzzle: number; date: string }) {
  const saveKey = `pastime:letterbox:${puzzle}`;
  const [rows, setRows] = useState<Row[]>([]);
  const [current, setCurrent] = useState("");
  const [answer, setAnswer] = useState<string>();
  const [solved, setSolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [toast, setToast] = useState<string>();
  // How many tiles of the newest row have finished flipping (colour swaps at the midpoint).
  const [revealed, setRevealed] = useState(WORD_LENGTH);
  const [revealingRow, setRevealingRow] = useState(-1);
  const [shared, setShared] = useState(false);

  const words = useRef<Set<string> | null>(null);
  // The saved copy may be stale; only a list fetched this visit is trusted to reject a word on its own.
  const wordsFresh = useRef(false);
  // Reused across retries of the same guess so the server never double-counts it.
  const pendingAction = useRef<{ guess: string; id: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A solved last row ends the game at once, before the reveal animation settles `solved`.
  const won = solved || (rows.length > 0 && isSolved(rows[rows.length - 1].feedback));
  const finished = won || rows.length >= MAX_GUESSES;

  // Resume + load the local word list once.
  useEffect(() => {
    const raw = safeGet(saveKey);
    if (raw) {
      try {
        const s = JSON.parse(raw) as Saved;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring saved state; localStorage is unavailable during SSR
        setRows(s.rows);
        setAnswer(s.answer);
        setSolved(s.solved);
      } catch {
        /* corrupt save: start fresh */
      }
    }
    const cached = safeGet(WORDS_KEY);
    if (cached) {
      try {
        words.current = new Set(JSON.parse(cached) as string[]);
      } catch {
        /* refetch below */
      }
    }
    // Always refresh in the background (cheap, and keeps a stale saved copy from misleading us).
    fetch("/api/letterbox/words?v=3")
      .then((r) => r.json())
      .then((d: { words: string[] }) => {
        words.current = new Set(d.words);
        wordsFresh.current = true;
        safeSet(WORDS_KEY, JSON.stringify(d.words));
      })
      .catch(() => {
        /* the server still validates every guess */
      });
  }, [saveKey]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(undefined), 1600);
  }, []);

  const reject = useCallback(
    (msg: string) => {
      setShake(true);
      showToast(msg);
      setTimeout(() => setShake(false), 280);
      navigator.vibrate?.(30);
    },
    [showToast],
  );

  const submit = useCallback(async () => {
    if (busy || finished) return;
    if (current.length < WORD_LENGTH) return reject("Not enough letters");
    // Reject instantly only with a list we know is current; otherwise the server decides.
    if (words.current && wordsFresh.current && !words.current.has(current)) return reject("Not in word list");

    // Same guess retried after a dropped request keeps its action id.
    if (pendingAction.current?.guess !== current) {
      pendingAction.current = { guess: current, id: newActionId() };
    }
    setBusy(true);
    try {
      const res = await fetch("/api/letterbox/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guess: current, clientActionId: pendingAction.current.id }),
      });
      if (res.status === 422) return reject("Not in word list");
      if (!res.ok) return showToast("Something went wrong. Try again.");

      const data = (await res.json()) as GuessResponse;
      pendingAction.current = null;
      const nextRows = [...rows, { guess: current, feedback: data.feedback }];
      const nowSolved = data.solved || isSolved(data.feedback);

      setRows(nextRows);
      setCurrent("");
      setRevealingRow(nextRows.length - 1);
      setRevealed(0);
      for (let i = 0; i < WORD_LENGTH; i++) {
        // colour swaps at each tile's flip midpoint: stagger + half of 250ms
        setTimeout(() => setRevealed((r) => Math.max(r, i + 1)), i * 80 + 125);
      }
      const done = nowSolved || nextRows.length >= MAX_GUESSES;
      if (done) {
        const settleMs = (WORD_LENGTH - 1) * 80 + 250;
        const icon = { correct: "🟩", present: "🟨", absent: "⬛" } as const;
        recordResult(date, "letterbox", {
          puzzle,
          solved: nowSolved,
          score: nextRows.length,
          grid: nextRows.map((r) => r.feedback.map((s) => icon[s]).join("")).join("\n"),
        });
        setTimeout(() => {
          setSolved(nowSolved);
          setAnswer(data.answer);
          navigator.vibrate?.(nowSolved ? [20, 40, 20] : 60);
        }, settleMs);
      }
      safeSet(
        saveKey,
        JSON.stringify({
          rows: nextRows,
          answer: data.answer,
          solved: nowSolved,
        } satisfies Saved),
      );
    } catch {
      // Offline: keep the typed guess so Enter can be pressed again.
      showToast("No signal. Your guess is kept, try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, finished, current, reject, showToast, rows, saveKey, puzzle, date]);

  const press = useCallback(
    (key: string) => {
      if (finished || busy) return;
      if (key === "enter") return void submit();
      if (key === "backspace") return setCurrent((c) => c.slice(0, -1));
      if (/^[a-z]$/.test(key)) setCurrent((c) => (c.length < WORD_LENGTH ? c + key : c));
    },
    [finished, busy, submit],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "enter" || k === "backspace" || /^[a-z]$/.test(k)) {
        e.preventDefault();
        press(k);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  // Keyboard colours wait for the newest row to finish flipping.
  const settledRows = revealed >= WORD_LENGTH ? rows : rows.slice(0, -1);
  const kbd = keyboardStates(settledRows);

  const share = async () => {
    const icon = { correct: "🟩", present: "🟨", absent: "⬛" } as const;
    const grid = rows.map((r) => r.feedback.map((s) => icon[s]).join("")).join("\n");
    const text = `Letterbox ${puzzle} ${solved ? rows.length : "X"}/${MAX_GUESSES}\n\n${grid}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  const grid = Array.from({ length: MAX_GUESSES }, (_, r) => {
    const row = rows[r];
    const isCurrent = r === rows.length && !finished;
    return Array.from({ length: WORD_LENGTH }, (_, c) => {
      const letter = row ? row.guess[c] : isCurrent ? current[c] : undefined;
      const flipping = r === revealingRow && !!row;
      const showState = row && (r !== revealingRow || c < revealed);
      return {
        key: `${r}-${c}`,
        letter,
        state: showState ? row.feedback[c] : undefined,
        flip: flipping,
        hop: solved && r === rows.length - 1,
        filled: !!letter && !row,
        shake: isCurrent && shake,
        c,
      };
    });
  });

  return (
    <div className="flex min-h-[calc(100dvh-56px)] md:min-h-[640px] flex-col px-4 pb-4">
      <div className="relative mt-3 h-6 text-center md:mt-2">
        {toast && (
          <span
            role="status"
            className="absolute left-1/2 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper"
          >
            {toast}
          </span>
        )}
      </div>

      <div
        className="mx-auto mt-2 grid w-full max-w-[330px] gap-1.5 md:max-w-[260px]"
        role="grid"
        aria-label="Letterbox guesses"
      >
        {grid.map((cells, r) => (
          <div
            key={r}
            role="row"
            className={`grid grid-cols-5 gap-1.5 ${cells[0].shake ? "row-shake" : ""}`}
          >
            {cells.map((t) => (
              <div
                key={t.key}
                role="gridcell"
                className="tile"
                style={{ ["--i" as string]: t.c }}
                data-state={t.state}
                data-filled={t.filled}
                data-flip={t.flip}
                data-hop={t.hop && revealed >= WORD_LENGTH}
                aria-label={t.letter ? `${t.letter} ${t.state ?? ""}` : "empty"}
              >
                {t.letter}
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="mt-3 flex items-center justify-center gap-4 text-xs text-ink-soft">
        <span><i className="tile mr-1 inline-block h-3 w-3 align-middle" data-state="correct" />Right spot</span>
        <span><i className="tile mr-1 inline-block h-3 w-3 align-middle" data-state="present" />In word</span>
        <span><i className="tile mr-1 inline-block h-3 w-3 align-middle" data-state="absent" />Not in word</span>
      </p>

      {finished && revealed >= WORD_LENGTH && answer && (
        <section className="card mx-auto mt-4 w-full max-w-[330px] bg-paper-deep p-4 text-center">
          <p className="text-xs text-ink-soft">The word was</p>
          <p className="font-pixel text-2xl uppercase tracking-widest">{answer}</p>
          <h2 className="mt-1 font-serif text-2xl font-bold">
            {won ? `Solved in ${rows.length}` : "Not this time"}
          </h2>
          <button
            onPointerDown={share}
            className="mt-3 h-12 w-full rounded-full border-[1.5px] border-ink bg-ink font-bold text-paper active:scale-[0.97]"
          >
            {shared ? "Copied" : "Share result"}
          </button>
          <Link href="/" className="mt-2 block py-2 text-sm underline">
            Back to Today
          </Link>
        </section>
      )}

      <div className={`mt-auto pt-4 ${finished ? "hidden" : ""}`} aria-label="Keyboard">
        {KEYS.map((row, i) => (
          <div key={row} className="mb-1.5 flex gap-1.5">
            {i === 2 && (
              <button
                className="key !flex-[1.6] bg-ink !text-paper"
                onPointerDown={() => press("enter")}
              >
                Enter
              </button>
            )}
            {[...row].map((k) => (
              <button
                key={k}
                className="key"
                data-state={kbd[k]}
                onPointerDown={() => press(k)}
              >
                {k}
              </button>
            ))}
            {i === 2 && (
              <button
                className="key !flex-[1.6]"
                aria-label="Backspace"
                onPointerDown={() => press("backspace")}
              >
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
