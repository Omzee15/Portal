"use client";

import PartySocket from "partysocket";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { GameFrame } from "@/components/GameFrame";
import { playerId, saveName, savedName } from "@/lib/identity";
import { computeStreak } from "@/lib/streak";
import type { FuseState, Player } from "@/lib/fuse/engine";
import { POWERUP_MIN_STREAK } from "@/lib/fuse/engine";
import { playedDates, recordResult, useResults } from "@/lib/store";
import { istDateOnClient } from "@/lib/clock";
import { copyText, partyHost } from "@/lib/browser";

const SKIN = ["bg-terracotta", "bg-mustard", "bg-sage", "bg-teal", "bg-mauve"];

const REASONS: Record<string, string> = {
  not_a_word: "Not in the dictionary",
  missing_chunk: "Must contain the letters",
  already_used: "Already used",
  bad_word: "Letters only, 3 or more",
  too_late: "Too late",
  not_your_turn: "Not your turn",
  no_powerup: "No power-up left",
  not_host: "Only the host can do that",
  need_more_players: "Need at least 2 players",
  in_progress: "That game has already started",
  room_full: "That room is full (12 players)",
};

type Status = "connecting" | "open" | "reconnecting" | "refused";

function Avatar({ p, active, you, size = "h-14 w-14" }: { p: Player; active?: boolean; you?: boolean; size?: string }) {
  const idx = [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0) % SKIN.length;
  return (
    <div className={`flex flex-col items-center ${p.out ? "opacity-40" : ""}`}>
      <div
        className={`${size} ${SKIN[idx]} font-pixel grid place-items-center rounded-2xl border-[1.5px] border-ink text-xl ${
          active ? "ring-4 ring-mustard ring-offset-2 ring-offset-mauve-wash" : ""
        }`}
      >
        {p.name.slice(0, 1).toUpperCase()}
      </div>
      <p className="mt-1 max-w-16 truncate text-[11px] font-bold">{you ? "You" : p.name}</p>
      <p className="text-[11px] leading-none text-brick" aria-label={`${p.lives} lives`}>
        {p.out ? "OUT" : "♥".repeat(p.lives)}
        {!p.connected && !p.out && <span className="ml-1 text-ink-soft">…</span>}
      </p>
    </div>
  );
}

export function FuseRoom({ code }: { code: string }) {
  const results = useResults();
  const [name, setName] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [game, setGame] = useState<FuseState | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [refusal, setRefusal] = useState<string>();
  const [toast, setToast] = useState<string>();
  const [text, setText] = useState("");
  const [tickNow, setTickNow] = useState(0);
  const [copied, setCopied] = useState(false);
  const offset = useRef(0); // serverNow - localNow
  const sock = useRef<PartySocket | null>(null);
  const lastKey = useRef("");
  const recorded = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const me = useMemo(() => (typeof window === "undefined" ? "" : playerId()), []);

  const streak = useMemo(
    () => computeStreak(playedDates(results), istDateOnClient()).current,
    [results],
  );

  // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring saved state; localStorage is unavailable during SSR
  useEffect(() => setName(savedName() || ""), []);

  const flash = (m: string) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(undefined), 1600);
  };

  // Connect once a name is set. PartySocket reconnects on its own; the server holds our seat for 60 s.
  useEffect(() => {
    if (!name) return;
    const ws = new PartySocket({ host: partyHost(), room: code, query: { pid: me, name, streak: String(streak) } });
    sock.current = ws;
    ws.addEventListener("open", () => setStatus("open"));
    ws.addEventListener("close", (e) => {
      if (e.code === 4001) setStatus("refused");
      else setStatus((s) => (s === "refused" ? s : "reconnecting"));
    });
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data as string);
      if (m.type === "state") {
        offset.current = m.serverNow - Date.now();
        setGame(m.state as FuseState);
      } else if (m.type === "rejected") {
        if (m.reason === "in_progress" || m.reason === "room_full") setRefusal(m.reason);
        else flash(REASONS[m.reason] ?? "Rejected");
      }
    });
    return () => ws.close();
    // streak is read once at connect time on purpose: it only decides the power-up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, code, me]);

  // Smooth fuse clock while a game is running.
  useEffect(() => {
    if (game?.phase !== "playing") return;
    const t = setInterval(() => setTickNow(Date.now() + offset.current), 100);
    return () => clearInterval(t);
  }, [game?.phase]);

  // Haptics + clear the input whenever the turn moves on.
  useEffect(() => {
    if (!game) return;
    const key = `${game.turns}:${game.last?.type}:${game.last?.playerId}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    setText("");
    if (game.last?.playerId === me) {
      if (game.last.type === "word") navigator.vibrate?.(15);
      else navigator.vibrate?.([60, 40, 60]);
    }
    if (game.phase === "playing" && game.turnId === me) inputRef.current?.focus();
  }, [game, me]);

  // Write the night into the journal once per game.
  useEffect(() => {
    if (game?.phase === "ended" && !recorded.current) {
      recorded.current = true;
      recordResult(istDateOnClient(), "fuse", {
        puzzle: 0,
        solved: game.winnerId === me,
        score: game.players.length,
        grid: "",
      });
    }
    if (game?.phase === "lobby") recorded.current = false;
  }, [game, me]);

  const send = (o: object) => sock.current?.send(JSON.stringify(o));

  if (name === null) return <GameFrame><div className="h-40" /></GameFrame>;

  if (!name) {
    return (
      <GameFrame>
        <form
          className="p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            saveName(draft);
            setName(draft.trim().slice(0, 16));
          }}
        >
          <h1 className="font-serif text-2xl font-bold">Join room {code}</h1>
          <label className="mt-4 block text-xs font-bold uppercase tracking-wide">
            Your name
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={16}
              autoFocus
              placeholder="e.g. Kabir"
              className="mt-1 h-12 w-full rounded-xl border-[1.5px] border-ink bg-paper px-3 text-base font-normal normal-case tracking-normal"
            />
          </label>
          <button className="mt-4 h-12 w-full rounded-full border-[1.5px] border-ink bg-ink font-bold text-paper">Join</button>
        </form>
      </GameFrame>
    );
  }

  if (status === "refused" || refusal) {
    return (
      <GameFrame>
        <div className="p-6 text-center">
          <h1 className="font-serif text-2xl font-bold">Can&apos;t join {code}</h1>
          <p className="mt-2">{REASONS[refusal ?? "in_progress"]}</p>
          <Link href="/party" className="mt-5 inline-block rounded-full border-[1.5px] border-ink bg-ink px-6 py-3 font-bold text-paper">
            Back to Party
          </Link>
        </div>
      </GameFrame>
    );
  }

  const copy = async () => {
    const link = `${location.origin}/r/${code}`;
    try {
      if (navigator.share) await navigator.share({ title: "Fuse on Portal", text: `Join my Fuse room ${code}`, url: link });
      else {
        await copyText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* dismissed */
    }
  };

  const header = (
    <header className="flex items-center justify-between border-b-[1.5px] border-ink bg-mauve px-3 py-2">
      <Link href="/party" aria-label="Leave room" className="grid h-11 w-11 place-items-center rounded-xl border-[1.5px] border-ink bg-paper">
        ×
      </Link>
      <div className="text-center">
        <h1 className="font-serif text-lg font-bold leading-none">Fuse</h1>
        <p className="font-pixel text-[10px]">ROOM {code}</p>
      </div>
      <button onPointerDown={copy} aria-label="Share invite link" className="grid h-11 w-11 place-items-center rounded-xl border-[1.5px] border-ink bg-paper text-sm">
        {copied ? "✓" : "↗"}
      </button>
    </header>
  );

  if (!game) {
    return (
      <GameFrame>
        {header}
        <p className="p-8 text-center text-sm text-ink-soft">{status === "reconnecting" ? "Reconnecting…" : "Joining…"}</p>
      </GameFrame>
    );
  }

  const isHost = game.hostId === me;
  const myTurn = game.phase === "playing" && game.turnId === me;
  const mine = game.players.find((p) => p.id === me);
  const banner = status === "reconnecting" && (
    <p role="status" className="bg-brick px-3 py-1 text-center text-xs font-bold text-paper">
      Reconnecting… your seat is held for 60 seconds
    </p>
  );
  const toastEl = toast && (
    <span role="status" className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper">
      {toast}
    </span>
  );

  if (game.phase === "lobby") {
    return (
      <GameFrame>
        {header}
        {banner}
        <div className="relative min-h-[calc(100dvh-56px)] md:min-h-[560px] bg-mauve-wash p-5">
          {toastEl}
          <p className="text-center text-xs text-ink-soft">Share this code or link</p>
          <button onPointerDown={copy} className="font-pixel mx-auto mt-1 block rounded-2xl border-[1.5px] border-dashed border-ink bg-paper px-6 py-3 text-4xl tracking-[0.3em]">
            {code}
          </button>
          <p className="mt-1 text-center text-xs text-ink-soft">{copied ? "Link copied" : "Tap to share the invite link"}</p>

          <h2 className="mt-6 font-serif font-bold">
            Players <span className="font-pixel text-xs">{game.players.length}/12</span>
          </h2>
          <ul className="mt-3 grid grid-cols-4 gap-3">
            {game.players.map((p) => (
              <li key={p.id} className="relative">
                <Avatar p={{ ...p, lives: 0 }} you={p.id === me} />
                {p.id === game.hostId && <span className="font-pixel absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-mustard px-1 text-[8px]">HOST</span>}
              </li>
            ))}
          </ul>

          {mine && mine.powerups > 0 && (
            <p className="mt-5 rounded-xl border-[1.5px] border-dashed border-ink bg-mustard/60 p-3 text-center text-sm">
              Streak power-up ready: +3 seconds, once this game.
            </p>
          )}
          {!mine?.powerups && (
            <p className="mt-5 text-center text-xs text-ink-soft">Keep a {POWERUP_MIN_STREAK}-day daily streak to earn a +3s power-up.</p>
          )}

          <div className="mt-5">
            {isHost ? (
              <button
                onPointerDown={() => send({ type: "start" })}
                disabled={game.players.filter((p) => p.connected).length < 2}
                className="h-12 w-full rounded-full border-[1.5px] border-ink bg-ink font-bold text-paper disabled:opacity-40 active:scale-[0.97]"
              >
                {game.players.length < 2 ? "Waiting for friends…" : "Start game"}
              </button>
            ) : (
              <p className="text-center text-sm text-ink-soft">Waiting for the host to start…</p>
            )}
          </div>
        </div>
      </GameFrame>
    );
  }

  if (game.phase === "ended") {
    const winner = game.players.find((p) => p.id === game.winnerId);
    return (
      <GameFrame>
        {header}
        {banner}
        <div className="relative min-h-[calc(100dvh-56px)] md:min-h-[560px] bg-mauve-wash p-6 text-center">
          {toastEl}
          <p className="text-xs text-ink-soft">Last one standing</p>
          {winner && (
            <div className="mt-3 flex justify-center">
              <Avatar p={winner} you={winner.id === me} size="h-20 w-20" />
            </div>
          )}
          <h2 className="mt-3 font-serif text-3xl font-bold">{winner ? (winner.id === me ? "You win" : `${winner.name} wins`) : "Nobody left"}</h2>
          <p className="mt-1 text-sm text-ink-soft">{game.used.length} words played</p>
          <ul className="mt-5 grid grid-cols-4 gap-3">
            {game.players.map((p) => (
              <li key={p.id}>
                <Avatar p={p} you={p.id === me} />
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-2">
            {isHost ? (
              <button onPointerDown={() => send({ type: "rematch" })} className="h-12 rounded-full border-[1.5px] border-ink bg-ink font-bold text-paper active:scale-[0.97]">
                Rematch
              </button>
            ) : (
              <p className="text-sm text-ink-soft">Waiting for the host to start a rematch…</p>
            )}
            <Link href="/" className="py-2 text-sm underline">
              Back to Today
            </Link>
          </div>
        </div>
      </GameFrame>
    );
  }

  // Playing: players in a ring around the bomb.
  // tickNow is server-synced time, advanced by the interval above; until the first tick show a full fuse.
  const remaining = tickNow ? Math.max(0, game.deadline - tickNow) : game.turnMs;
  const frac = Math.min(1, remaining / game.turnMs);
  const urgent = remaining < 3000;
  const turnPlayer = game.players.find((p) => p.id === game.turnId);

  return (
    <GameFrame>
      {header}
      {banner}
      <div className="relative flex min-h-[calc(100dvh-56px)] md:min-h-[600px] flex-col bg-mauve-wash px-4 pb-4">
        {toastEl}
        <div className="relative mx-auto mt-6 aspect-square w-full max-w-[340px]">
          <div className="absolute inset-[22%] rounded-full border border-dashed border-ink-soft" />
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className={`text-5xl ${urgent ? "animate-pulse" : ""}`} aria-hidden>
                💣
              </div>
              <p
                key={game.chunk + game.turns}
                className="font-pixel pop-in mt-1 rounded-xl border-[1.5px] border-ink bg-paper px-4 py-2 text-3xl uppercase tracking-widest"
                aria-label={`Letters: ${game.chunk}`}
              >
                {game.chunk}
              </p>
            </div>
          </div>
          {game.players.map((p, i) => {
            const a = (2 * Math.PI * i) / game.players.length - Math.PI / 2;
            return (
              <div
                key={p.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${50 + 41 * Math.cos(a)}%`, top: `${50 + 41 * Math.sin(a)}%` }}
              >
                <Avatar p={p} active={p.id === game.turnId} you={p.id === me} size="h-11 w-11" />
              </div>
            );
          })}
        </div>

        <p className="mt-3 flex items-center justify-between text-sm">
          <b>{myTurn ? "Your turn" : `${turnPlayer?.name ?? "…"}'s turn`}</b>
          <span className="font-pixel">{(remaining / 1000).toFixed(1)}s</span>
        </p>
        <div className="mt-1 h-3 overflow-hidden rounded-full border-[1.5px] border-ink bg-paper" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(frac * 100)}>
          <div className={`h-full origin-left ${urgent ? "bg-brick" : "bg-mustard"}`} style={{ transform: `scaleX(${frac})`, transition: "transform 100ms linear" }} />
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!myTurn || !text.trim()) return;
            send({ type: "submit", word: text });
          }}
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value.toLowerCase().replace(/[^a-z]/g, ""))}
            placeholder={myTurn ? `Word with ${game.chunk.toUpperCase()}` : "Wait for your turn"}
            aria-label="Your word"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={30}
            className="font-pixel h-12 min-w-0 flex-1 rounded-xl border-[1.5px] border-ink bg-paper px-3 text-lg uppercase"
          />
          <button disabled={!myTurn || !text.trim()} className="h-12 rounded-full border-[1.5px] border-ink bg-ink px-6 font-bold text-paper disabled:opacity-40 active:scale-[0.97]">
            Go
          </button>
        </form>

        {mine && mine.powerups > 0 && !mine.out && (
          <button
            onPointerDown={() => send({ type: "powerup" })}
            disabled={!myTurn}
            className="mt-3 flex min-h-11 items-center justify-between rounded-xl border-[1.5px] border-dashed border-ink bg-mustard px-3 text-sm font-bold disabled:opacity-50"
          >
            <span>Streak power-up ready: +3 seconds</span>
            <span className="rounded-full bg-paper px-3 py-1">Use</span>
          </button>
        )}
        {mine?.out && <p className="mt-3 text-center text-sm text-ink-soft">You&apos;re out. Watch the rest.</p>}

        {game.used.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-ink-soft">Used:</span>
            {game.used.slice(-10).map((w) => (
              <span key={w} className="rounded-full border border-ink-soft px-2 py-0.5 line-through">
                {w}
              </span>
            ))}
          </p>
        )}
      </div>
    </GameFrame>
  );
}
