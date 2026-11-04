"use client";

import { useState } from "react";
import { Chip, RoomFrame, Timer, primaryButton, type Room } from "./RoomFrame";
import { MIN_PLAYERS, TURN_MS } from "@/lib/hintline/rules";
import type { Card, HView, Team } from "@/lib/hintline/engine";

const TEAM: Record<Team, { name: string; bg: string }> = { a: { name: "Team Teal", bg: "bg-teal" }, b: { name: "Team Rust", bg: "bg-terracotta" } };
const REASONS = {
  clue_on_board: "That's on the board, or part of a word on it",
  one_word_only: "One word only",
  not_your_clue: "It's not your clue to give",
  not_your_guess: "Your team's guessers pick the cards",
  teams_too_small: "Each team needs at least 2 players",
  need_more_players: `Hintline needs at least ${MIN_PLAYERS} players`,
};
const COVER: Record<Card, string> = { a: "bg-teal", b: "bg-terracotta", plain: "bg-stone", trap: "bg-ink text-paper" };

function Game({ room, share }: { room: Room<HView>; share: React.ReactNode }) {
  const { game, me, isHost, send, now } = room;
  const [word, setWord] = useState("");
  const [count, setCount] = useState(1);
  const mine = game.players.find((p) => p.id === me);

  if (game.phase === "lobby") {
    return (
      <>
        {share}
        <div className="mt-5 rounded-xl border-[1.5px] border-dashed border-ink bg-paper p-3 text-sm">
          <b>How it works.</b> Two teams, 25 words. Each team&apos;s clue-giver sees which words are theirs and gives a one-word clue plus a number. Find all your words first, and never touch the trap.
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {(["a", "b"] as Team[]).map((t) => (
            <section key={t} className={`card p-3 ${TEAM[t].bg}`}>
              <h2 className="font-serif font-bold">{TEAM[t].name}</h2>
              <ul className="mt-1 min-h-10 text-sm">
                {game.players.filter((p) => p.team === t).map((p) => (
                  <li key={p.id}>{p.id === me ? "You" : p.name}{p.role === "clue" ? " · clues" : ""}</li>
                ))}
              </ul>
              <button onClick={() => send({ type: "seat", team: t, role: "guess" })} className="mt-2 min-h-11 w-full rounded-full border-[1.5px] border-ink bg-paper text-sm font-bold">Guess</button>
              <button onClick={() => send({ type: "seat", team: t, role: "clue" })} className="mt-1 min-h-11 w-full rounded-full border-[1.5px] border-ink bg-paper text-sm font-bold">Give clues</button>
            </section>
          ))}
        </div>
        <ul className="mt-4 flex flex-wrap gap-3">
          {game.players.filter((p) => !p.team).map((p) => <li key={p.id}><Chip name={p.name} you={p.id === me} /></li>)}
        </ul>
        <div className="mt-4">
          {isHost ? (
            <button onClick={() => send({ type: "start" })} disabled={game.players.length < MIN_PLAYERS} className={primaryButton}>
              {game.players.length < MIN_PLAYERS ? `Need ${MIN_PLAYERS} players (${game.players.length} here)` : "Start game"}
            </button>
          ) : <p className="text-center text-sm text-ink-soft">Waiting for the host to start…</p>}
          <p className="mt-2 text-center text-xs text-ink-soft">Anyone without a team is placed automatically.</p>
        </div>
      </>
    );
  }

  const ended = game.phase === "ended";
  const myTurn = mine?.team === game.turn;
  const canPick = game.phase === "guess" && myTurn && mine?.role === "guess";
  return (
    <>
      <div className="flex items-center justify-between font-bold">
        <span className="rounded-full border-[1.5px] border-ink bg-teal px-3 py-1 text-sm">Teal {game.left.a}</span>
        <span className="rounded-full border-[1.5px] border-ink bg-terracotta px-3 py-1 text-sm">Rust {game.left.b}</span>
      </div>
      {ended ? (
        <h2 className="mt-3 text-center font-serif text-2xl font-bold">{TEAM[game.winner!].name} wins{game.reason === "trap" ? ": the other team hit the trap" : ""}</h2>
      ) : (
        <div className="mt-3">
          <Timer left={game.deadline - now} total={TURN_MS} label={`${TEAM[game.turn].name}: ${game.phase === "clue" ? "clue" : "guessing"}`} />
          {game.clue && <p className="mt-2 text-center"><span className="font-pixel text-lg uppercase">{game.clue.word} · {game.clue.count}</span> <span className="text-xs">({game.guessesLeft} guesses left)</span></p>}
        </div>
      )}
      {/* The 5×5 board stretches to the height that's left, within reason, so it fits short and tall screens. */}
      <div className="mt-3 grid max-h-[440px] min-h-52 flex-1 grid-cols-5 grid-rows-5 gap-1" role="group" aria-label="Board">
        {game.board.map((c, i) => (
          <button
            key={c.word}
            disabled={!canPick || c.up}
            onClick={() => send({ type: "reveal", index: i })}
            aria-label={`${c.word}${c.card ? `, ${c.card}` : ""}${c.up ? ", turned over" : ""}`}
            className={`min-h-0 rounded-lg border-[1.5px] border-ink p-0.5 text-[10px] font-bold uppercase leading-tight break-words ${c.up ? COVER[c.card!] : c.card ? `${COVER[c.card]} border-dashed` : "bg-paper"} ${c.up ? "line-through" : ""}`}
          >
            {c.word}
          </button>
        ))}
      </div>
      {!ended && game.phase === "clue" && myTurn && mine?.role === "clue" && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send({ type: "clue", word, count });
            setWord("");
          }}
        >
          <input value={word} onChange={(e) => setWord(e.target.value)} aria-label="Your clue" placeholder="One-word clue" autoComplete="off" className="h-12 min-w-0 flex-1 rounded-xl border-[1.5px] border-ink bg-paper px-3" />
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="How many words" className="h-12 rounded-xl border-[1.5px] border-ink bg-paper px-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n}>{n}</option>)}
          </select>
          <button disabled={!word.trim()} className="h-12 rounded-full border-[1.5px] border-ink bg-ink px-5 font-bold text-paper disabled:opacity-40">Give</button>
        </form>
      )}
      {canPick && <button onClick={() => send({ type: "pass" })} className="mt-3 h-12 w-full rounded-full border-[1.5px] border-ink bg-paper font-bold">End our turn</button>}
      {!ended && !canPick && !(game.phase === "clue" && myTurn && mine?.role === "clue") && <p className="mt-3 text-center text-sm text-ink-soft">{game.phase === "clue" ? "Waiting for the clue…" : "Waiting for the guessers…"}</p>}
      {ended && (isHost ? <button onClick={() => send({ type: "rematch" })} className={`mt-4 ${primaryButton}`}>Play again</button> : <p className="mt-4 text-center text-sm text-ink-soft">Waiting for the host…</p>)}
    </>
  );
}

export function HintlineRoom({ code }: { code: string }) {
  return <RoomFrame<HView> party="hintline" title="Hintline" bg="bg-teal" path="h" code={code} reasons={REASONS} render={(room, share) => <Game room={room} share={share} />} />;
}
