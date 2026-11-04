"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Chip, RoomFrame, Timer, primaryButton, type Room } from "./RoomFrame";
import { CHOOSE_MS, MAX_CHAT, MAX_POINTS, MAX_PLAYERS, MIN_PLAYERS, PALETTE, REVEAL_MS, ROUND_CHOICES, TIME_CHOICES, WIDTHS, type Stroke } from "@/lib/doodle/rules";
import type { DoodleView } from "@/lib/doodle/engine";

const SIZE = 320;
const SEND_EVERY_MS = 150;
const REASONS = { not_drawer: "Only the drawer can do that", bad_drawing: "That drawing is too big to send" };

function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.lineCap = ctx.lineJoin = "round";
  for (const s of strokes) {
    ctx.strokeStyle = s.c;
    ctx.lineWidth = s.w;
    ctx.beginPath();
    ctx.moveTo(s.p[0], s.p[1]);
    for (let i = 2; i < s.p.length; i += 2) ctx.lineTo(s.p[i], s.p[i + 1]);
    if (s.p.length === 2) ctx.lineTo(s.p[0] + 0.1, s.p[1]);
    ctx.stroke();
  }
}

const canvasClass = "block h-full w-full rounded-xl border-[1.5px] border-ink bg-white";

/** Holds the square canvas at the largest size the space allows, with anything laid over it. */
function Stage({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  return (
    <div className="flex min-h-40 flex-1 items-center justify-center [container-type:size]">
      <div className="relative aspect-square w-[min(100cqw,100cqh)]">
        {children}
        {overlay}
      </div>
    </div>
  );
}

/** What the guessers watch: the drawer's picture, updated as they draw. */
function Sketch({ strokes, overlay }: { strokes: Stroke[]; overlay?: ReactNode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) paint(ctx, strokes);
  }, [strokes]);
  return <Stage overlay={overlay}><canvas ref={ref} width={SIZE} height={SIZE} role="img" aria-label="The drawing" className={canvasClass} /></Stage>;
}

/** The drawer's canvas. It sends the whole picture a few times a second while a line is being drawn. */
function Pad({ initial, send }: { initial: Stroke[]; send: (o: object) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>(initial);
  const live = useRef<Stroke | null>(null);
  const sentAt = useRef(0);
  const [colour, setColour] = useState(PALETTE[0]);
  const [width, setWidth] = useState(WIDTHS[0]);
  const all = () => (live.current ? [...strokes.current, live.current] : strokes.current);
  const redraw = () => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) paint(ctx, all());
  };
  const push = () => {
    sentAt.current = Date.now();
    send({ type: "draw", strokes: all() });
  };
  useEffect(redraw, []);
  const at = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const clamp = (n: number) => Math.max(0, Math.min(SIZE, Math.round(n)));
    return [clamp(((e.clientX - r.left) / r.width) * SIZE), clamp(((e.clientY - r.top) / r.height) * SIZE)];
  };
  const used = () => all().reduce((n, s) => n + s.p.length / 2, 0);
  const end = () => {
    if (!live.current) return;
    strokes.current = [...strokes.current, live.current];
    live.current = null;
    push();
  };
  const edit = (next: Stroke[]) => {
    strokes.current = next;
    redraw();
    push();
  };
  const tool = "h-9 rounded-full border-[1.5px] border-ink bg-paper px-3 text-xs font-bold";
  return (
    <>
      <Stage>
        <canvas
          ref={ref}
          width={SIZE}
          height={SIZE}
          aria-label="Drawing pad"
          className={`${canvasClass} touch-none`}
          onPointerDown={(e) => {
            if (used() >= MAX_POINTS) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            live.current = { c: colour, w: width, p: at(e) };
            redraw();
          }}
          onPointerMove={(e) => {
            if (!live.current || used() >= MAX_POINTS) return;
            const [x, y] = at(e);
            const p = live.current.p;
            if (Math.abs(p[p.length - 2] - x) + Math.abs(p[p.length - 1] - y) < 3) return; // thin the line out to stay small
            p.push(x, y);
            redraw();
            if (Date.now() - sentAt.current > SEND_EVERY_MS) push();
          }}
          onPointerUp={end}
          onPointerCancel={end}
        />
      </Stage>
      <div className="mt-2 flex shrink-0 flex-wrap items-center justify-center gap-1.5">
        {PALETTE.map((c) => (
          <button key={c} aria-label={c === "#ffffff" ? "Eraser" : `Colour ${c}`} aria-pressed={colour === c} onClick={() => setColour(c)} className={`grid h-8 w-8 place-items-center rounded-full border-[1.5px] border-ink text-xs ${colour === c ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: c }}>
            {c === "#ffffff" ? "⌫" : ""}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex shrink-0 items-center justify-center gap-1.5">
        {WIDTHS.map((w) => (
          <button key={w} aria-label={`Brush ${w}`} aria-pressed={width === w} onClick={() => setWidth(w)} className={`grid h-9 w-9 place-items-center rounded-full border-[1.5px] border-ink ${width === w ? "bg-ink" : "bg-paper"}`}>
            <span className={`block rounded-full ${width === w ? "bg-paper" : "bg-ink"}`} style={{ width: Math.min(w, 16), height: Math.min(w, 16) }} />
          </button>
        ))}
        <button onClick={() => edit(strokes.current.slice(0, -1))} className={tool}>Undo</button>
        <button onClick={() => edit([])} className={tool}>Clear</button>
      </div>
    </>
  );
}

function Chat({ room }: { room: Room<DoodleView> }) {
  const { game, me, send } = room;
  const [text, setText] = useState("");
  const log = useRef<HTMLOListElement>(null);
  const last = game.chat.at(-1)?.n;
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [last]);
  const who = (id: string | null) => (id === me ? "You" : (game.players.find((p) => p.id === id)?.name ?? ""));
  const mine = game.players.find((p) => p.id === me);
  const drawing = game.phase === "drawing";
  const placeholder = drawing && game.drawer !== me && !mine?.guessed ? "Type your guess" : "Chat";
  const tone = { chat: "", inner: "italic text-ink-soft", correct: "my-0.5 rounded bg-sage px-1 font-bold", close: "my-0.5 rounded bg-mustard px-1 font-bold", system: "font-bold" };
  return (
    <div className="mt-2 flex flex-col md:min-h-0 md:flex-1">
      <ol ref={log} aria-label="Chat" className="h-24 overflow-y-auto [@media(min-height:780px)]:h-32 md:h-auto md:min-h-0 md:flex-1 rounded-xl border-[1.5px] border-ink bg-paper p-2 text-sm">
        {game.chat.map((m) => (
          <li key={m.n} className={tone[m.kind]}>
            {m.by && m.kind !== "correct" ? <b>{who(m.by)}: </b> : null}
            {m.kind === "correct" && m.by === me ? "You guessed the word!" : m.text}
          </li>
        ))}
      </ol>
      <form
        className="mt-2 flex shrink-0 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          send({ type: "chat", text });
          setText("");
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_CHAT} aria-label="Guess or chat" placeholder={placeholder} autoComplete="off" autoCapitalize="none" spellCheck={false} className="h-11 min-w-0 flex-1 rounded-xl border-[1.5px] border-ink bg-paper px-3" />
        <button disabled={!text.trim()} className="h-11 rounded-full border-[1.5px] border-ink bg-ink px-5 font-bold text-paper disabled:opacity-40">Send</button>
      </form>
    </div>
  );
}

function Scores({ game, me }: { game: DoodleView; me: string }) {
  const ranked = [...game.players].sort((a, b) => b.score - a.score);
  return (
    <ul className="mt-2 flex shrink-0 gap-2 overflow-x-auto pb-1 md:mt-0 md:max-h-40 md:flex-col md:overflow-y-auto" aria-label="Scores">
      {ranked.map((p) => (
        <li key={p.id} className={`flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-ink px-2.5 py-1 text-xs ${p.guessed ? "bg-sage" : "bg-paper"} ${p.connected ? "" : "opacity-50"}`}>
          {p.id === game.drawer && <span aria-label="drawing">✏️</span>}
          <b className="max-w-20 truncate md:max-w-none md:flex-1">{p.id === me ? "You" : p.name}</b>
          <span className="font-pixel">{p.score}</span>
        </li>
      ))}
    </ul>
  );
}

function Game({ room, share }: { room: Room<DoodleView>; share: React.ReactNode }) {
  const { game, me, isHost, send, now } = room;
  const drawerName = game.drawer === me ? "You" : (game.players.find((p) => p.id === game.drawer)?.name ?? "Someone");

  if (game.phase === "lobby") {
    const settings = [["Rounds", "rounds", ROUND_CHOICES, (v: number) => `${v}`], ["Draw time", "drawMs", TIME_CHOICES, (v: number) => `${v / 1000}s`]] as const;
    return (
      <>
        {share}
        <div className="mt-5 rounded-xl border-[1.5px] border-dashed border-ink bg-paper p-3 text-sm">
          <b>How it works.</b> Take turns drawing. The drawer picks one of three words and draws it; everyone else types guesses in the chat. The faster you guess, the more you score, and the drawer scores for every player who gets it. Letters appear as hints when time runs low. Everyone draws once each round.
        </div>
        <div className="mt-4 flex flex-col gap-2 text-sm">
          {settings.map(([label, key, choices, show]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-20 text-xs font-bold uppercase tracking-wide">{label}</span>
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
        <h2 className="mt-5 font-serif font-bold">Players <span className="font-pixel text-xs">{game.players.length}/{MAX_PLAYERS}</span></h2>
        <ul className="mt-3 grid grid-cols-4 gap-3">{game.players.map((p) => <li key={p.id}><Chip name={p.name} you={p.id === me} /></li>)}</ul>
        <div className="mt-6">
          {isHost ? <button onClick={() => send({ type: "start" })} disabled={game.players.length < MIN_PLAYERS} className={primaryButton}>{game.players.length < MIN_PLAYERS ? "Waiting for friends…" : "Start game"}</button> : <p className="text-center text-sm text-ink-soft">Waiting for the host to start…</p>}
        </div>
      </>
    );
  }

  if (game.phase === "final") {
    const ranked = [...game.players].sort((a, b) => b.score - a.score);
    return (
      <>
        <div className="text-center">
          <p className="text-xs text-ink-soft">Final scores</p>
          <h2 className="font-serif text-3xl font-bold">{ranked[0].id === me ? "You win" : `${ranked[0].name} wins`}</h2>
        </div>
        <ol className="mt-4 flex flex-col gap-2">
          {ranked.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border-[1.5px] border-ink bg-paper px-3 py-2">
              <span className="font-pixel w-5 text-sm">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{p.id === me ? "You" : p.name}</span>
              <span className="font-pixel text-lg">{p.score}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6">{isHost ? <button onClick={() => send({ type: "rematch" })} className={primaryButton}>Play again</button> : <p className="text-center text-sm text-ink-soft">Waiting for the host…</p>}</div>
      </>
    );
  }

  const total = game.phase === "choosing" ? CHOOSE_MS : game.phase === "drawing" ? game.drawMs : REVEAL_MS;
  const drawing = game.phase === "drawing" && game.drawer === me;
  const turnKey = `${game.round}-${game.turn}`;
  const overlay = game.phase === "choosing" && game.drawer === me ? (
    <div className="absolute inset-0 flex flex-col justify-center gap-2 rounded-xl bg-paper/95 p-6">
      {game.choices.map((w, i) => <button key={w} onClick={() => send({ type: "choose", index: i })} className="h-12 rounded-full border-[1.5px] border-ink bg-paper font-bold capitalize active:scale-[0.97]">{w}</button>)}
    </div>
  ) : game.phase === "turnEnd" ? (
    <div className="absolute inset-0 flex flex-col justify-center overflow-y-auto rounded-xl bg-paper/95 p-5">
      <ul className="flex flex-col gap-1 text-sm">
        {[...game.players].sort((a, b) => b.gained - a.gained).map((p) => (
          <li key={p.id} className="flex justify-between">
            <span className="truncate font-bold">{p.id === me ? "You" : p.name}{p.id === game.drawer ? " ✏️" : ""}</span>
            <span className={`font-pixel ${p.gained ? "" : "text-ink-soft"}`}>+{p.gained}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : null;
  return (
    <>
      <Timer left={game.deadline - now} total={total} label={`Round ${game.round} of ${game.rounds}`} />
      <div className="mt-2 text-center" aria-live="polite">
        {game.phase === "drawing" && (
          game.drawer === me
            ? <p className="text-sm">Draw: <b className="font-pixel text-lg uppercase">{game.word}</b></p>
            : <p aria-label="The word" className="font-pixel text-xl tracking-[0.3em] uppercase">{game.word}<span className="ml-2 text-xs tracking-normal text-ink-soft">{game.word.replace(/ /g, "").length}</span></p>
        )}
        {game.phase === "choosing" && <p className="text-sm font-bold">{game.drawer === me ? "Pick a word to draw" : `${drawerName} is choosing a word…`}</p>}
        {game.phase === "turnEnd" && <p className="text-sm">The word was <b className="font-pixel text-lg uppercase">{game.word}</b></p>}
      </div>
      {/* Phones stack the canvas over the chat; laptops put the chat beside it, like skribbl. */}
      <div className="mt-2 flex min-h-0 flex-1 flex-col md:flex-row md:gap-4">
        <div className="flex min-h-0 flex-1 flex-col">
          {drawing ? <Pad key={turnKey} initial={game.strokes} send={send} /> : <Sketch strokes={game.strokes} overlay={overlay} />}
        </div>
        <div className="flex shrink-0 flex-col md:min-h-0 md:w-72">
          <Scores game={game} me={me} />
          <Chat room={room} />
        </div>
      </div>
    </>
  );
}

export function DoodleRoom({ code }: { code: string }) {
  return <RoomFrame<DoodleView> party="doodle" title="Doodle Dash" bg="bg-sage" path="s" code={code} reasons={REASONS} wide={(g) => g.phase !== "lobby" && g.phase !== "final"} render={(room, share) => <Game room={room} share={share} />} />;
}
