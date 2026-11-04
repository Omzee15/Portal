"use client";

import { useEffect, useRef, useState } from "react";
import { Chip, RoomFrame, Timer, primaryButton, type Room } from "./RoomFrame";
import { MAX_GUESSES, WORD_LENGTH, keyboardStates, type TileState } from "@/lib/letterbox/scoring";
import { MIN_PLAYERS, ROUNDS, ROUND_MS } from "@/lib/duel/rules";
import type { DView } from "@/lib/duel/engine";

const REASONS = { not_a_word: "Not in word list", out_of_guesses: "You're out of guesses, watch the others", waiting: "Wait for the others to guess" };
const TILE: Record<TileState, string> = { correct: "bg-sage", present: "bg-mustard", absent: "bg-stone" };
const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

type Player = DView["players"][number];

/** A rival's board: colours only, plus whether they've locked in this turn. */
function Mini({ p }: { p: Player }) {
  return (
    <div className="flex flex-col gap-0.5">
      {Array.from({ length: MAX_GUESSES }, (_, r) => (
        <div key={r} className="flex gap-0.5">
          {Array.from({ length: WORD_LENGTH }, (_, c) => {
            const row = p.rows[r];
            const next = r === p.rows.length && p.locked;
            return <span key={c} className={`h-3 w-3 rounded-sm border border-ink [@media(max-height:700px)]:h-2 [@media(max-height:700px)]:w-2 ${row ? TILE[row.marks[c]] : next ? "bg-ink" : "bg-paper"}`} />;
          })}
        </div>
      ))}
    </div>
  );
}

function Board({ mine, draft, shake }: { mine: Player; draft: string; shake: boolean }) {
  const typing = mine.pending ?? draft;
  return (
    <div className="grid w-[min(100cqw,300px,calc((100cqh-2px)*0.83))] gap-1.5" role="grid" aria-label="Your guesses">
      {Array.from({ length: MAX_GUESSES }, (_, r) => {
        const row = mine.rows[r];
        const current = r === mine.rows.length;
        return (
          <div key={r} role="row" className={`grid grid-cols-5 gap-1.5 ${current && shake ? "row-shake" : ""}`}>
            {Array.from({ length: WORD_LENGTH }, (_, c) => {
              const letter = row ? row.guess?.[c] : current ? typing[c] : undefined;
              return (
                <div
                  key={c}
                  role="gridcell"
                  className={`tile ${current && mine.pending ? "opacity-60" : ""}`}
                  style={{ ["--i" as string]: c }}
                  data-state={row?.marks[c]}
                  data-filled={!!letter && !row}
                  data-flip={!!row && r === mine.rows.length - 1}
                  aria-label={letter ? `${letter} ${row?.marks[c] ?? ""}` : "empty"}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function Racing({ room }: { room: Room<DView> }) {
  const { game, me, send, now } = room;
  const mine = game.players.find((p) => p.id === me);
  const rivals = game.players.filter((p) => p.id !== me);
  const turn = mine?.rows.length ?? 0;
  // The draft belongs to one turn, so it clears itself once that turn's guesses are revealed.
  const [draft, setDraft] = useState({ turn: 0, text: "" });
  const [shake, setShake] = useState(false);
  const text = draft.turn === turn ? draft.text : "";
  const out = turn >= MAX_GUESSES;
  const blocked = !mine || out || !!mine.pending;

  const press = (key: string) => {
    if (blocked) return;
    if (key === "enter") {
      if (text.length < WORD_LENGTH) {
        setShake(true);
        setTimeout(() => setShake(false), 280);
        return;
      }
      return send({ type: "guess", word: text });
    }
    const nextText = key === "backspace" ? text.slice(0, -1) : /^[a-z]$/.test(key) && text.length < WORD_LENGTH ? text + key : text;
    setDraft({ turn, text: nextText });
  };
  // The keyboard listener stays put and always calls the newest `press`.
  const latest = useRef(press);
  useEffect(() => {
    latest.current = press;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "enter" || k === "backspace" || /^[a-z]$/.test(k)) {
        e.preventDefault();
        latest.current(k);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!mine) return null;
  const kbd = keyboardStates(mine.rows.map((r) => ({ guess: r.guess ?? "", feedback: r.marks })));
  const waitingOn = rivals.filter((p) => p.connected && !p.locked && p.rows.length < MAX_GUESSES);
  const status = out
    ? "Out of guesses. Watch the others."
    : mine.pending
      ? `Locked in. Waiting for ${waitingOn.map((p) => p.name).join(", ") || "the others"}…`
      : rivals.some((p) => p.locked)
        ? `${rivals.filter((p) => p.locked).map((p) => p.name).join(", ")} locked in. Your turn.`
        : "Everyone guesses, then all rows flip together.";

  return (
    <>
      <Timer left={game.deadline - now} total={ROUND_MS} label={`Round ${game.round} of ${ROUNDS}`} />
      <p role="status" className="mt-2 min-h-5 text-center text-xs font-bold">{status}</p>
      <ul className="mt-2 flex flex-wrap justify-center gap-4">
        {rivals.map((p) => (
          <li key={p.id} className="flex flex-col items-center">
            <p className="mb-1 max-w-20 truncate text-[11px] font-bold">{p.locked ? "✓ " : ""}{p.name}</p>
            <Mini p={p} />
          </li>
        ))}
      </ul>
      {/* The board takes the height that's left and sizes its tiles to fit. */}
      <div className="mt-2 flex min-h-20 flex-1 items-center justify-center [container-type:size]"><Board mine={mine} draft={text} shake={shake} /></div>
      <div className={`mt-3 shrink-0 [@media(max-height:700px)]:mt-1.5 ${out ? "hidden" : ""}`} aria-label="Keyboard">
        {KEYS.map((row, i) => (
          <div key={row} className="mb-1.5 flex gap-1.5">
            {i === 2 && <button className="key !flex-[1.6] bg-ink !text-paper disabled:opacity-40" disabled={blocked} onPointerDown={() => press("enter")}>Enter</button>}
            {[...row].map((k) => <button key={k} className="key" data-state={kbd[k]} disabled={blocked} onPointerDown={() => press(k)}>{k}</button>)}
            {i === 2 && <button className="key !flex-[1.6]" aria-label="Backspace" disabled={blocked} onPointerDown={() => press("backspace")}>⌫</button>}
          </div>
        ))}
      </div>
    </>
  );
}

function Game({ room, share }: { room: Room<DView>; share: React.ReactNode }) {
  const { game, me, isHost, send } = room;

  if (game.phase === "lobby") {
    return (
      <>
        {share}
        <div className="mt-5 rounded-xl border-[1.5px] border-dashed border-ink bg-paper p-3 text-sm">
          <b>How it works.</b> Everyone guesses the same hidden 5-letter word. Each turn, all rows flip together once everyone has entered a guess. You see rivals&apos; colours but never their letters. Solve it first to take the round; solve it on the same turn and you share it. {ROUNDS} rounds.
        </div>
        <ul className="mt-5 grid grid-cols-4 gap-3">{game.players.map((p) => <li key={p.id}><Chip name={p.name} you={p.id === me} /></li>)}</ul>
        <div className="mt-6">
          {isHost ? <button onClick={() => send({ type: "start" })} disabled={game.players.length < MIN_PLAYERS} className={primaryButton}>{game.players.length < MIN_PLAYERS ? "Waiting for friends…" : "Start game"}</button> : <p className="text-center text-sm text-ink-soft">Waiting for the host to start…</p>}
        </div>
      </>
    );
  }

  // Keyed by round so the next round starts with an empty draft.
  if (game.phase === "racing") return <Racing key={game.round} room={room} />;

  const ranked = [...game.players].sort((a, b) => b.total - a.total);
  const final = game.phase === "final";
  const names = game.players.filter((p) => game.winners.includes(p.id)).map((p) => (p.id === me ? "You" : p.name));
  return (
    <>
      <div className="text-center">
        <p className="text-xs text-ink-soft">{final ? "Final scores" : `Round ${game.round} of ${ROUNDS}`}</p>
        <h2 className="font-serif text-3xl font-bold">{final ? (ranked[0].id === me ? "You win" : `${ranked[0].name} wins`) : names.length ? `${names.join(" and ")} got it` : "Nobody got it"}</h2>
        {!final && game.answer && <p className="font-pixel mt-1 text-lg uppercase">{game.answer}</p>}
      </div>
      <ol className="mt-4 flex flex-col gap-2">
        {ranked.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl border-[1.5px] border-ink bg-paper px-3 py-2">
            <span className="font-pixel w-5 text-sm">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-bold">{p.id === me ? "You" : p.name}</span>
            <span className="font-pixel text-lg">{p.total}</span>
          </li>
        ))}
      </ol>
      <div className="mt-6">
        {isHost ? <button onClick={() => send({ type: final ? "rematch" : "next" })} className={primaryButton}>{final ? "Play again" : game.round >= ROUNDS ? "Final results" : "Next round"}</button> : <p className="text-center text-sm text-ink-soft">Waiting for the host…</p>}
      </div>
    </>
  );
}

export function DuelRoom({ code }: { code: string }) {
  return <RoomFrame<DView> party="duel" title="Letterbox Duel" bg="bg-terracotta" path="d" code={code} reasons={REASONS} render={(room, share) => <Game room={room} share={share} />} />;
}
