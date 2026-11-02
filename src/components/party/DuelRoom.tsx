"use client";

import { useState } from "react";
import { Chip, RoomFrame, Timer, primaryButton, type Room } from "./RoomFrame";
import { MAX_GUESSES, type TileState } from "@/lib/letterbox/scoring";
import { MIN_PLAYERS, ROUNDS, ROUND_MS } from "@/lib/duel/rules";
import type { DView } from "@/lib/duel/engine";

const REASONS = { not_a_word: "Not in the word list", out_of_guesses: "You're out of guesses, watch the others" };
const TILE: Record<TileState, string> = { correct: "bg-sage", present: "bg-mustard", absent: "bg-stone" };

function Rows({ rows, small }: { rows: DView["players"][number]["rows"]; small?: boolean }) {
  const cell = small ? "h-3.5 w-3.5 rounded-sm" : "font-pixel grid h-11 w-11 place-items-center rounded-lg text-lg uppercase";
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: MAX_GUESSES }, (_, r) => (
        <div key={r} className="flex gap-1">
          {Array.from({ length: 5 }, (_, c) => {
            const row = rows[r];
            return <span key={c} className={`${cell} border-[1.5px] border-ink ${row ? TILE[row.marks[c]] : "bg-paper"}`}>{small ? "" : row?.guess?.[c] ?? ""}</span>;
          })}
        </div>
      ))}
    </div>
  );
}

function Game({ room, share }: { room: Room<DView>; share: React.ReactNode }) {
  const { game, me, isHost, send, now } = room;
  const [text, setText] = useState("");
  const mine = game.players.find((p) => p.id === me);
  const rivals = game.players.filter((p) => p.id !== me);

  if (game.phase === "lobby") {
    return (
      <>
        {share}
        <div className="mt-5 rounded-xl border-[1.5px] border-dashed border-ink bg-paper p-3 text-sm">
          <b>How it works.</b> Everyone races to find the same hidden 5-letter word. You see rivals&apos; colours but not their letters. First to solve takes the round. {ROUNDS} rounds.
        </div>
        <ul className="mt-5 grid grid-cols-4 gap-3">{game.players.map((p) => <li key={p.id}><Chip name={p.name} you={p.id === me} /></li>)}</ul>
        <div className="mt-6">
          {isHost ? <button onClick={() => send({ type: "start" })} disabled={game.players.length < MIN_PLAYERS} className={primaryButton}>{game.players.length < MIN_PLAYERS ? "Waiting for friends…" : "Start game"}</button> : <p className="text-center text-sm text-ink-soft">Waiting for the host to start…</p>}
        </div>
      </>
    );
  }

  if (game.phase === "racing") {
    return (
      <>
        <Timer left={game.deadline - now} total={ROUND_MS} label={`Round ${game.round} of ${ROUNDS}`} />
        <div className="mt-3 flex justify-center">{mine && <Rows rows={mine.rows} />}</div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.length !== 5) return;
            send({ type: "guess", word: text });
            setText("");
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value.toLowerCase().replace(/[^a-z]/g, "").slice(0, 5))} aria-label="Your guess" placeholder="5 letters" autoComplete="off" autoCapitalize="none" spellCheck={false} className="font-pixel h-12 min-w-0 flex-1 rounded-xl border-[1.5px] border-ink bg-paper px-3 text-lg uppercase" />
          <button disabled={text.length !== 5} className="h-12 rounded-full border-[1.5px] border-ink bg-ink px-6 font-bold text-paper disabled:opacity-40">Go</button>
        </form>
        <ul className="mt-4 flex flex-wrap justify-center gap-4">
          {rivals.map((p) => (
            <li key={p.id} className="text-center">
              <p className="mb-1 max-w-24 truncate text-xs font-bold">{p.name}</p>
              <Rows rows={p.rows} small />
            </li>
          ))}
        </ul>
      </>
    );
  }

  const ranked = [...game.players].sort((a, b) => b.total - a.total);
  const final = game.phase === "final";
  const winner = game.players.find((p) => p.id === game.roundWinner);
  return (
    <>
      <div className="text-center">
        <p className="text-xs text-ink-soft">{final ? "Final scores" : `Round ${game.round} of ${ROUNDS}`}</p>
        <h2 className="font-serif text-3xl font-bold">{final ? (ranked[0].id === me ? "You win" : `${ranked[0].name} wins`) : winner ? `${winner.id === me ? "You" : winner.name} got it` : "Nobody got it"}</h2>
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
