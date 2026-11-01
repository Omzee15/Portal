"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { recordResult } from "@/lib/store";
import { TIER_STYLE } from "@/lib/tier-style";
import type { Tier } from "@/lib/schedule";

type Saved = {
  image: string;
  tier: Tier;
  wrong: string[];
  hints?: string[];
  finished: boolean;
  solved: boolean;
  answer?: string;
  credit?: { source: string; license: string };
};
type GuessResponse = {
  correct: boolean;
  step: number;
  finished: boolean;
  image: string;
  hint?: string;
  answer?: string;
  credit?: { source: string; license: string };
  sticker?: string;
};

const MAX = 5;

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

export function PixelPeek({ puzzle, date }: { puzzle: number; date: string }) {
  const key = `portal:pixel2:${puzzle}`;
  const [s, setS] = useState<Saved | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string>();
  const [shared, setShared] = useState(false);
  const pending = useRef<{ g: string; id: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flash = (m: string) => {
    setToast(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(undefined), 1600);
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
    fetch("/api/pixel/start")
      .then((r) => r.json())
      .then((d: { image?: string; tier: Tier }) => {
        if (!d.image) throw new Error("image_unavailable");
        setS({ image: d.image, tier: d.tier, wrong: [], finished: false, solved: false });
      })
      .catch(() => flash("Today's picture is unavailable right now. Try again in a moment."));
  }, [key]);

  if (!s) return <p className="p-6 text-center text-sm text-ink-soft">{toast ?? "Loading…"}</p>;

  const used = s.wrong.length + (s.solved ? 1 : 0);

  const submit = async () => {
    const g = text.trim();
    if (!g || busy || s.finished) return;
    if (s.wrong.includes(g.toLowerCase())) return flash("Already guessed");
    if (pending.current?.g !== g) pending.current = { g, id: crypto.randomUUID().replace(/-/g, "") };
    setBusy(true);
    try {
      const res = await fetch("/api/pixel/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guess: g, clientActionId: pending.current.id }),
      });
      if (!res.ok) return flash("Something went wrong. Try again.");
      const d = (await res.json()) as GuessResponse;
      pending.current = null;
      const next: Saved = {
        image: d.image,
        tier: s.tier,
        wrong: d.correct ? s.wrong : [...s.wrong, g.toLowerCase()],
        hints: d.hint ? [...(s.hints ?? []), d.hint] : s.hints,
        finished: d.finished,
        solved: d.correct,
        answer: d.answer,
        credit: d.credit,
      };
      setS(next);
      safeSet(key, JSON.stringify(next));
      setText("");
      if (!d.correct) {
        navigator.vibrate?.(40);
        if (!d.finished) flash("Not quite. The picture sharpens…");
      } else navigator.vibrate?.([20, 40, 20]);
      if (d.finished) {
        recordResult(date, "pixel-peek", {
          puzzle,
          solved: d.correct,
          score: d.step,
          grid: [...next.wrong.map(() => "🟥"), ...(d.correct ? ["🟩"] : [])].join(""),
          sticker: d.sticker,
        });
      }
    } catch {
      flash("No signal. Your guess is kept, try again.");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const line = [...s.wrong.map(() => "🟥"), ...(s.solved ? ["🟩"] : [])].join("");
    const msg = `Pixel Peek ${puzzle} ${s.solved ? s.wrong.length + 1 : "X"}/${MAX} (${s.tier})\n\n${line}`;
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
    <div className="flex min-h-[calc(100dvh-56px)] md:min-h-[640px] flex-col px-4 pb-5">
      <div className="relative mt-3 h-6 text-center">
        {toast && (
          <span role="status" className="absolute left-1/2 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper">
            {toast}
          </span>
        )}
      </div>

      <div className="card mx-auto mt-2 w-full max-w-[340px] overflow-hidden bg-paper-deep p-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered data URL, already sized */}
        <img key={s.image.length + used} src={s.image} alt="A blurred picture to identify" className="img-in aspect-square w-full rounded-lg object-cover" />
        <div className="mt-2 flex items-center justify-between px-1">
          <span className={`font-pixel rounded px-1.5 py-0.5 text-[10px] uppercase ${TIER_STYLE[s.tier]}`}>{s.tier}</span>
          <span className="flex items-center gap-1 text-[11px] text-ink-soft" aria-label={`Sharpness ${Math.min(used + 1, MAX)} of ${MAX}`}>
            Sharpness
            {Array.from({ length: MAX }, (_, i) => (
              <span key={i} className={`h-2 w-3 rounded-sm border border-ink ${i <= (s.finished ? MAX - 1 : used) ? "bg-ink" : ""}`} />
            ))}
          </span>
        </div>
      </div>

      <p className="mt-3 flex items-center justify-center gap-2 text-sm text-ink-soft">
        Guesses left
        {Array.from({ length: MAX }, (_, i) => (
          <span key={i} className={`h-3 w-3 rounded-full border-[1.5px] border-ink ${i < MAX - used ? "bg-sage" : ""}`} />
        ))}
      </p>

      {s.wrong.length > 0 && (
        <ul className="mt-2 flex flex-wrap justify-center gap-1.5">
          {s.wrong.map((w) => (
            <li key={w} className="rounded-full border border-ink-soft px-2 py-0.5 text-xs line-through">
              {w}
            </li>
          ))}
        </ul>
      )}

      {(s.hints?.length ?? 0) > 0 && (
        <ul className="mx-auto mt-3 w-full max-w-[340px] space-y-1.5">
          {s.hints!.map((h, i) => (
            <li key={i} className="rounded-xl border-[1.5px] border-dashed border-ink bg-mustard/50 px-3 py-2 text-sm">
              <span className="font-pixel mr-2 text-[10px]">HINT {i + 1}</span>
              {h}
            </li>
          ))}
        </ul>
      )}

      {!s.finished ? (
        <form
          className="mt-auto flex gap-2 pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What is it?"
            autoComplete="off"
            autoCapitalize="none"
            enterKeyHint="go"
            maxLength={40}
            className="h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-ink bg-paper px-4"
          />
          <button disabled={busy || !text.trim()} className="h-12 rounded-full border-[1.5px] border-ink bg-ink px-6 font-bold text-paper disabled:opacity-40 active:scale-[0.97]">
            Go
          </button>
        </form>
      ) : (
        <section className="card mt-5 bg-paper-deep p-4 text-center">
          <p className="text-xs text-ink-soft">It was</p>
          <p className="font-serif text-2xl font-bold">{s.answer}</p>
          <h2 className="mt-1 font-serif text-xl">{s.solved ? `Got it in ${s.wrong.length + 1}` : "Not this time"}</h2>
          <button onPointerDown={share} className="mt-3 h-12 w-full rounded-full border-[1.5px] border-ink bg-ink font-bold text-paper active:scale-[0.97]">
            {shared ? "Copied" : "Share result"}
          </button>
          <Link href="/" className="mt-2 block py-2 text-sm underline">
            Back to Today
          </Link>
          {s.credit && (
            <p className="mt-1 text-[10px] text-ink-soft">
              Image: <a className="underline" href={s.credit.source} target="_blank" rel="noreferrer">Wikimedia Commons</a> ({s.credit.license})
            </p>
          )}
        </section>
      )}
    </div>
  );
}
