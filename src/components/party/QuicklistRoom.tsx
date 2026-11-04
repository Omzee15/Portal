"use client";

import PartySocket from "partysocket";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { GameFrame } from "@/components/GameFrame";
import { playerId, saveName, savedName } from "@/lib/identity";
import { istDateOnClient } from "@/lib/clock";
import { recordResult } from "@/lib/store";
import {
  CATEGORIES_PER_ROUND, LETTERS, MAX_ANSWER_LEN, MIN_WRITE_MS, ROUND_CHOICES, TIMER_CHOICES, judge, startsWith, winners,
  type QState, type RoundRecord, type Verdict,
} from "@/lib/quicklist/engine";
import { copyText, partyHost } from "@/lib/browser";

const SKIN = ["bg-terracotta", "bg-mustard", "bg-sage", "bg-teal", "bg-mauve"];

const REASONS: Record<string, string> = {
  not_host: "Only the host can do that",
  need_more_players: "Need at least 2 players",
  in_progress: "That game has already started",
  room_full: "That room is full (12 players)",
  not_writing: "Time's up for writing",
  too_soon: "Give everyone at least 30 seconds",
};

const VERDICT: Record<Verdict, { label: string; cls: string }> = {
  unique: { label: "+1", cls: "bg-sage" },
  duplicate: { label: "match, 0", cls: "bg-stone" },
  rejected: { label: "voted out", cls: "bg-brick text-paper" },
  unconfirmed: { label: "needs a ✓", cls: "bg-mustard" },
  "wrong-letter": { label: "wrong letter", cls: "bg-brick text-paper" },
  empty: { label: "blank", cls: "bg-transparent border border-dashed border-ink-soft" },
};

type Status = "connecting" | "open" | "reconnecting" | "refused";

function Chip({ name, you, total }: { name: string; you: boolean; total?: number }) {
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % SKIN.length;
  return (
    <div className="flex flex-col items-center">
      <div className={`font-pixel grid h-11 w-11 place-items-center rounded-2xl border-[1.5px] border-ink text-lg ${SKIN[idx]}`}>
        {name.slice(0, 1).toUpperCase()}
      </div>
      <p className="mt-1 max-w-16 truncate text-[11px] font-bold">{you ? "You" : name}</p>
      {total !== undefined && <p className="font-pixel text-[11px] leading-none">{total}</p>}
    </div>
  );
}

/** Spins through letters for a moment before landing on the round's letter, if the round has only just begun. */
function DrawnLetter({ letter, fresh }: { letter: string; fresh: boolean }) {
  // remounted per round (keyed), so `fresh` only matters on the first render
  const [spinning, setSpinning] = useState(fresh);
  const [face, setFace] = useState(LETTERS[0]);
  useEffect(() => {
    if (!spinning) return;
    let i = 0;
    const spin = setInterval(() => setFace(LETTERS[(i += 7) % LETTERS.length]), 70);
    const stop = setTimeout(() => setSpinning(false), 1100);
    return () => {
      clearInterval(spin);
      clearTimeout(stop);
    };
  }, [spinning]);
  return <p className={`font-pixel rounded-xl border-[1.5px] border-ink bg-mustard px-5 py-1 text-4xl leading-tight ${spinning ? "opacity-60" : ""}`} aria-live="polite">{spinning ? face : letter}</p>;
}

/** Every answer in a finished round with what it scored, so nobody has to wonder where a point went. */
function Breakdown({ record, players, me }: { record: RoundRecord; players: QState["players"]; me: string }) {
  return (
    <div className="flex flex-col gap-2">
      {record.categories.map((c, ci) => (
        <section key={c} className="rounded-xl border-[1.5px] border-ink bg-paper p-3">
          <h4 className="text-sm font-bold">{c}</h4>
          <ul className="mt-1 flex flex-col gap-1">
            {players.map((p) => {
              const a = (record.answers[p.id]?.[ci] ?? "").trim();
              const v = record.verdicts[p.id]?.[ci] ?? "empty";
              return (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span className="w-16 shrink-0 truncate text-xs text-ink-soft">{p.id === me ? "You" : p.name}</span>
                  <span className={`min-w-0 flex-1 truncate ${v === "unique" ? "" : "text-ink-soft"}`}>{a || "—"}</span>
                  <span className={`font-pixel shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase ${v === "unique" ? "bg-sage" : ""}`}>{v === "unique" ? "+1" : v === "unconfirmed" ? "not accepted" : VERDICT[v].label}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function QuicklistRoom({ code }: { code: string }) {
  const [name, setName] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [game, setGame] = useState<QState | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [refusal, setRefusal] = useState<string>();
  const [toast, setToast] = useState<string>();
  /** local drafts per round; falls back to the server's copy (so a reconnect restores them) */
  const [drafts, setDrafts] = useState<Record<number, string[]>>({});
  const [tickNow, setTickNow] = useState(0);
  /** server time on the latest update, so a round that has only just begun can draw its letter */
  const [serverAt, setServerAt] = useState(0);
  const [copied, setCopied] = useState(false);
  const offset = useRef(0);
  const sock = useRef<PartySocket | null>(null);
  const recorded = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const me = useMemo(() => (typeof window === "undefined" ? "" : playerId()), []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring the saved name; localStorage is unavailable during SSR
  useEffect(() => setName(savedName() || ""), []);

  const flash = (m: string) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(undefined), 1700);
  };

  useEffect(() => {
    if (!name) return;
    const ws = new PartySocket({ host: partyHost(), party: "quicklist", room: code, query: { pid: me, name } });
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
        setServerAt(m.serverNow);
        setGame(m.state as QState);
      } else if (m.type === "rejected") {
        if (m.reason === "in_progress" || m.reason === "room_full") setRefusal(m.reason);
        else flash(REASONS[m.reason] ?? "Rejected");
      }
    });
    return () => ws.close();
  }, [name, code, me]);

  const phase = game?.phase;
  useEffect(() => {
    if (phase !== "writing") return;
    const t = setInterval(() => setTickNow(Date.now() + offset.current), 250);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (game?.phase === "final" && !recorded.current) {
      recorded.current = true;
      recordResult(istDateOnClient(), "quicklist", {
        puzzle: 0,
        solved: winners(game).includes(me),
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
            if (!draftName.trim()) return;
            saveName(draftName);
            setName(draftName.trim().slice(0, 16));
          }}
        >
          <h1 className="font-serif text-2xl font-bold">Join room {code}</h1>
          <label className="mt-4 block text-xs font-bold uppercase tracking-wide">
            Your name
            <input value={draftName} onChange={(e) => setDraftName(e.target.value)} maxLength={16} autoFocus placeholder="e.g. Kabir" className="mt-1 h-12 w-full rounded-xl border-[1.5px] border-ink bg-paper px-3 text-base font-normal normal-case tracking-normal" />
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
          <Link href="/party" className="mt-5 inline-block rounded-full border-[1.5px] border-ink bg-ink px-6 py-3 font-bold text-paper">Back to Party</Link>
        </div>
      </GameFrame>
    );
  }

  const copy = async () => {
    const link = `${location.origin}/q/${code}`;
    try {
      if (navigator.share) await navigator.share({ title: "Quicklist on Portal", text: `Join my Quicklist room ${code}`, url: link });
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
    <header className="flex items-center justify-between border-b-[1.5px] border-ink bg-teal px-3 py-2">
      <Link href="/party" aria-label="Leave room" className="grid h-11 w-11 place-items-center rounded-xl border-[1.5px] border-ink bg-paper">×</Link>
      <div className="text-center">
        <h1 className="font-serif text-lg font-bold leading-none">Quicklist</h1>
        <p className="font-pixel text-[10px]">ROOM {code}</p>
      </div>
      <button onPointerDown={copy} aria-label="Share invite link" className="grid h-11 w-11 place-items-center rounded-xl border-[1.5px] border-ink bg-paper text-sm">{copied ? "✓" : "↗"}</button>
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
  const banner = status === "reconnecting" && (
    <p role="status" className="bg-brick px-3 py-1 text-center text-xs font-bold text-paper">Reconnecting… your seat is held for 60 seconds</p>
  );
  const toastEl = toast && (
    <span role="status" className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper">{toast}</span>
  );
  const wrap = (body: React.ReactNode) => (
    <GameFrame>
      {header}
      {banner}
      <div className="relative flex flex-col bg-paper-deep/60 p-4">
        {toastEl}
        {body}
      </div>
    </GameFrame>
  );

  const total = game.writeMs;
  // until the first tick, show a full bar rather than 0s
  const remaining = tickNow ? Math.max(0, game.deadline - tickNow) : total;
  const frac = Math.min(1, remaining / total);
  const timer = (
    <>
      <div className="mt-2 flex items-center justify-between text-sm">
        <b>Write fast</b>
        <span className="font-pixel">{Math.ceil(remaining / 1000)}s</span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full border-[1.5px] border-ink bg-paper" role="progressbar" aria-valuenow={Math.round(frac * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full origin-left ${remaining < 10_000 ? "bg-brick" : "bg-mustard"}`} style={{ transform: `scaleX(${frac})`, transition: "transform 250ms linear" }} />
      </div>
    </>
  );
  const mine = game.players.find((p) => p.id === me);

  // ---------- lobby ----------
  if (game.phase === "lobby") {
    return wrap(
      <>
        <p className="text-center text-xs text-ink-soft">Share this code or link</p>
        <button onPointerDown={copy} className="font-pixel mx-auto mt-1 block rounded-2xl border-[1.5px] border-dashed border-ink bg-paper px-6 py-3 text-4xl tracking-[0.3em]">{code}</button>
        <p className="mt-1 text-center text-xs text-ink-soft">{copied ? "Link copied" : "Tap to share the invite link"}</p>
        <div className="mt-5 rounded-xl border-[1.5px] border-dashed border-ink bg-paper p-3 text-sm">
          <b>How it works.</b> {game.rounds} rounds. Each round has a letter and {CATEGORIES_PER_ROUND} categories. Write an answer starting with that letter for each. After the first 30 seconds, the first to press Done ends the round for everyone. Answers must really fit the question, in English or Hinglish, and spelling slips are fine. If the game doesn&apos;t know an answer, the group decides. Answers that match another player&apos;s score nothing.
        </div>
        <div className="mt-4 flex flex-col gap-2 text-sm">
          {([["Rounds", "rounds", ROUND_CHOICES, (v: number) => `${v}`], ["Timer", "writeMs", TIMER_CHOICES, (v: number) => `${v / 60_000}m`]] as const).map(([label, key, choices, show]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-14 text-xs font-bold uppercase tracking-wide">{label}</span>
              {isHost ? (
                choices.map((v) => (
                  <button key={v} onPointerDown={() => send({ type: "configure", [key]: v })} aria-pressed={game[key] === v} className={`h-9 min-w-11 rounded-full border-[1.5px] border-ink px-3 font-bold ${game[key] === v ? "bg-ink text-paper" : "bg-paper"}`}>
                    {show(v)}
                  </button>
                ))
              ) : (
                <span>{show(game[key])}</span>
              )}
            </div>
          ))}
        </div>
        <h2 className="mt-4 font-serif font-bold">Players <span className="font-pixel text-xs">{game.players.length}/12</span></h2>
        <ul className="mt-3 grid grid-cols-4 gap-3">
          {game.players.map((p) => (
            <li key={p.id} className="relative">
              <Chip name={p.name} you={p.id === me} />
              {p.id === game.hostId && <span className="font-pixel absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-mustard px-1 text-[8px]">HOST</span>}
            </li>
          ))}
        </ul>
        <div className="mt-6">
          {isHost ? (
            <button onPointerDown={() => send({ type: "start" })} disabled={game.players.filter((p) => p.connected).length < 2} className="h-12 w-full rounded-full border-[1.5px] border-ink bg-ink font-bold text-paper disabled:opacity-40 active:scale-[0.97]">
              {game.players.length < 2 ? "Waiting for friends…" : "Start game"}
            </button>
          ) : (
            <p className="text-center text-sm text-ink-soft">Waiting for the host to start…</p>
          )}
        </div>
      </>,
    );
  }

  // ---------- writing ----------
  if (game.phase === "writing") {
    const lockedFor = tickNow ? game.startedAt + MIN_WRITE_MS - tickNow : MIN_WRITE_MS;
    const values = drafts[game.round] ?? game.answers[me] ?? new Array(CATEGORIES_PER_ROUND).fill("");
    const set = (cat: number, text: string) => {
      const next = [...values];
      next[cat] = text.slice(0, MAX_ANSWER_LEN);
      setDrafts((d) => ({ ...d, [game.round]: next }));
      send({ type: "answer", cat, text: next[cat] });
    };
    return wrap(
      <>
        <div className="flex items-center justify-between">
          <span className="font-pixel text-xs">ROUND {game.round}/{game.rounds}</span>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-ink-soft">Letter</p>
            <DrawnLetter key={game.round} letter={game.letter} fresh={serverAt - game.startedAt < 2000} />
          </div>
          <span className="w-16" />
        </div>
        {timer}
        {/* The answers scroll on their own so the timer and Done stay on screen. */}
        <ol className="-mx-1 mt-3 flex min-h-32 flex-1 flex-col gap-2 overflow-y-auto px-1 pb-1 md:grid md:auto-rows-min md:grid-cols-2 md:gap-x-3">
          {game.categories.map((c, i) => {
            const v = values[i] ?? "";
            const wrong = v.trim() !== "" && !startsWith(v.trim(), game.letter);
            return (
              <li key={c}>
                <label className="block">
                  <span className="text-xs font-bold">{i + 1}. {c}</span>
                  <input
                    value={v}
                    onChange={(e) => set(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const nextInput = e.currentTarget.closest("ol")?.querySelectorAll("input")[i + 1] as HTMLInputElement | undefined;
                        nextInput?.focus();
                      }
                    }}
                    placeholder={`${game.letter}…`}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint={i === CATEGORIES_PER_ROUND - 1 ? "done" : "next"}
                    className={`mt-0.5 h-11 w-full rounded-xl border-[1.5px] bg-paper px-3 disabled:opacity-60 ${wrong ? "border-brick text-brick" : "border-ink"}`}
                  />
                </label>
                {wrong && <p className="text-[11px] text-brick">Must start with {game.letter}</p>}
              </li>
            );
          })}
        </ol>
        <div className="mt-3 shrink-0">
          <button onPointerDown={() => send({ type: "done" })} disabled={lockedFor > 0} className="h-12 w-full rounded-full border-[1.5px] border-ink bg-ink font-bold text-paper disabled:opacity-50 active:scale-[0.97]">
            {lockedFor > 0 ? `Done unlocks in ${Math.ceil(lockedFor / 1000)}s` : "Done"}
          </button>
          <p className="mt-1 text-center text-xs text-ink-soft">The first to press Done ends the round for everyone.</p>
          <ul className="mt-3 flex flex-wrap justify-center gap-3 [@media(max-height:900px)]:hidden">
            {game.players.map((p) => (
              <li key={p.id}><Chip name={p.name} you={p.id === me} /></li>
            ))}
          </ul>
        </div>
      </>,
    );
  }

  // ---------- review ----------
  if (game.phase === "review") {
    return wrap(
      <>
        <div className="flex items-center justify-between">
          <span className="font-pixel text-xs">ROUND {game.round}/{game.rounds}</span>
          <span className="font-pixel rounded-xl border-[1.5px] border-ink bg-mustard px-4 py-0.5 text-2xl">{game.letter}</span>
          <span className="w-16" />
        </div>
        <h2 className="mt-3 font-serif text-xl font-bold">Review answers</h2>
        <p className="mt-1 text-xs text-ink-soft">Matching answers score nothing. Tap ✓ to accept an answer the game doesn&apos;t recognise; it needs half of the others. Tap ✗ to throw out a recognised one that doesn&apos;t fit; that takes more than half.</p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Points this round so far">
          {game.players.map((p) => (
            <li key={p.id} className="rounded-full border-[1.5px] border-ink bg-paper px-3 py-1 text-xs font-bold">
              {p.id === me ? "You" : p.name} <span className="font-pixel">+{game.categories.filter((_, ci) => judge(game, ci)[p.id] === "unique").length}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-col gap-3">
          {game.categories.map((c, ci) => {
            const verdicts = judge(game, ci);
            return (
              <section key={c} className="rounded-xl border-[1.5px] border-ink bg-paper p-3">
                <h3 className="text-sm font-bold">{ci + 1}. {c}</h3>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {game.players.map((p) => {
                    const a = (game.answers[p.id]?.[ci] ?? "").trim();
                    const v = verdicts[p.id] ?? "empty";
                    const flags = game.flags[`${p.id}:${ci}`] ?? [];
                    const iFlagged = flags.includes(me);
                    const listed = !!game.known[`${p.id}:${ci}`];
                    return (
                      <li key={p.id} className="flex items-center gap-2 text-sm">
                        <span className="w-16 shrink-0 truncate text-xs text-ink-soft">{p.id === me ? "You" : p.name}</span>
                        <span className={`min-w-0 flex-1 truncate ${v === "rejected" ? "line-through" : ""}`}>{a || "—"}</span>
                        <span className={`font-pixel shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase ${VERDICT[v].cls}`}>{VERDICT[v].label}</span>
                        {p.id !== me && a && (
                          <button
                            onPointerDown={() => send({ type: "flag", owner: p.id, cat: ci })}
                            aria-pressed={iFlagged}
                            aria-label={listed ? `Mark ${p.name}'s answer not valid` : `Accept ${p.name}'s answer`}
                            className={`min-h-9 shrink-0 rounded-full border-[1.5px] border-ink px-2 text-[11px] font-bold ${iFlagged ? (listed ? "bg-brick text-paper" : "bg-sage") : ""}`}
                          >
                            {listed ? "✗" : "✓"}{flags.length ? ` ${flags.length}` : ""}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
        <button onPointerDown={() => send({ type: "ready" })} disabled={!!mine?.ready} className="mt-4 h-12 w-full rounded-full border-[1.5px] border-ink bg-ink font-bold text-paper disabled:opacity-50 active:scale-[0.97]">
          {mine?.ready ? "Waiting for the others…" : "Ready for scores"}
        </button>
        {isHost && game.players.some((p) => p.connected && !p.ready) && mine?.ready && (
          <button onPointerDown={() => send({ type: "reveal" })} className="mt-2 w-full py-2 text-center text-sm underline">Show scores now</button>
        )}
      </>,
    );
  }

  // ---------- results + final ----------
  const final = game.phase === "final";
  const ranked = [...game.players].sort((a, b) => b.total - a.total);
  const wins = winners(game);
  const gained = (id: string) => (game.roundPoints[id] ?? []).reduce((a, b) => a + b, 0);
  return wrap(
    <>
      <div className="text-center">
        <p className="text-xs text-ink-soft">{final ? "Final scores" : `Round ${game.round} of ${game.rounds} done`}</p>
        <h2 className="font-serif text-3xl font-bold">
          {final ? (wins.length > 1 ? "A tie at the top" : wins[0] === me ? "You win" : `${game.players.find((p) => p.id === wins[0])?.name} wins`) : "Scores"}
        </h2>
      </div>
      <ol className="mt-4 flex flex-col gap-2">
        {ranked.map((p, i) => (
          <li key={p.id} className={`flex items-center gap-3 rounded-xl border-[1.5px] border-ink px-3 py-2 ${final && wins.includes(p.id) ? "bg-mustard" : "bg-paper"}`}>
            <span className="font-pixel w-5 text-sm">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-bold">{p.id === me ? "You" : p.name}</span>
            {!final && <span className="font-pixel text-xs text-ink-soft">+{gained(p.id)}</span>}
            <span className="font-pixel text-lg">{p.total}</span>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-col gap-2">
        {isHost ? (
          <button onPointerDown={() => send({ type: final ? "rematch" : "next" })} className="h-12 rounded-full border-[1.5px] border-ink bg-ink font-bold text-paper active:scale-[0.97]">
            {final ? "Play again" : game.round >= game.rounds ? "Final results" : "Next round"}
          </button>
        ) : (
          <p className="text-center text-sm text-ink-soft">Waiting for the host…</p>
        )}
        {final && <Link href="/" className="py-2 text-center text-sm underline">Back to Today</Link>}
      </div>
      <h3 className="mt-6 font-serif text-lg font-bold">Where the points came from</h3>
      {final ? (
        game.history.map((r, i) => (
          <details key={i} className="mt-2">
            <summary className="cursor-pointer text-sm font-bold">Round {i + 1} · letter {r.letter}</summary>
            <div className="mt-2"><Breakdown record={r} players={game.players} me={me} /></div>
          </details>
        ))
      ) : (
        game.history.at(-1) && <div className="mt-2"><Breakdown record={game.history.at(-1)!} players={game.players} me={me} /></div>
      )}
    </>,
  );
}
