"use client";

import { useEffect, useRef, useState } from "react";
import { Chip, RoomFrame, Timer, primaryButton, type Room } from "./RoomFrame";
import { DRAW_MS, GUESS_MS, MAX_POINTS, MIN_PLAYERS, PALETTE, WRITE_MS, type DoodleView, type Stroke } from "@/lib/doodle/engine";

const SIZE = 320;

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

function Sketch({ strokes, label }: { strokes: Stroke[]; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) paint(ctx, strokes);
  }, [strokes]);
  return <canvas ref={ref} width={SIZE} height={SIZE} role="img" aria-label={label} className="mx-auto block w-full max-w-[320px] rounded-xl border-[1.5px] border-ink bg-white" />;
}

function Pad({ onChange, onDone }: { onChange: (s: Stroke[]) => void; onDone: (s: Stroke[]) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const live = useRef<Stroke | null>(null);
  const [colour, setColour] = useState(PALETTE[0]);
  const [width, setWidth] = useState(3);
  const redraw = () => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) paint(ctx, live.current ? [...strokes.current, live.current] : strokes.current);
  };
  useEffect(redraw, []);
  const at = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const clamp = (n: number) => Math.max(0, Math.min(SIZE, Math.round(n)));
    return [clamp(((e.clientX - r.left) / r.width) * SIZE), clamp(((e.clientY - r.top) / r.height) * SIZE)];
  };
  const used = () => strokes.current.reduce((n, s) => n + s.p.length / 2, 0) + (live.current?.p.length ?? 0) / 2;
  const end = () => {
    if (!live.current) return;
    strokes.current = [...strokes.current, live.current];
    live.current = null;
    onChange(strokes.current);
  };
  return (
    <>
      <canvas
        ref={ref}
        width={SIZE}
        height={SIZE}
        aria-label="Drawing pad"
        className="mx-auto block w-full max-w-[320px] touch-none rounded-xl border-[1.5px] border-ink bg-white"
        onPointerDown={(e) => {
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
        }}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <div className="mt-2 flex items-center justify-between gap-1">
        {PALETTE.map((c) => <button key={c} aria-label={`Colour ${c}`} onClick={() => setColour(c)} className={`h-10 w-10 rounded-full border-[1.5px] border-ink ${colour === c ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: c }} />)}
        <button onClick={() => setWidth(width === 3 ? 8 : 3)} className="h-10 rounded-full border-[1.5px] border-ink bg-paper px-3 text-xs font-bold">{width === 3 ? "Thin" : "Thick"}</button>
        <button onClick={() => { strokes.current = strokes.current.slice(0, -1); redraw(); onChange(strokes.current); }} className="h-10 rounded-full border-[1.5px] border-ink bg-paper px-3 text-xs font-bold">Undo</button>
      </div>
      <button onClick={() => onDone(strokes.current)} className={`mt-3 ${primaryButton}`}>Done</button>
    </>
  );
}

function Game({ room, share }: { room: Room<DoodleView>; share: React.ReactNode }) {
  const { game, me, isHost, send, now } = room;
  const [text, setText] = useState("");
  const name = (id: string) => (id === me ? "You" : (game.players.find((p) => p.id === id)?.name ?? "Someone"));
  const mine = game.players.find((p) => p.id === me);

  if (game.phase === "lobby") {
    return (
      <>
        {share}
        <div className="mt-5 rounded-xl border-[1.5px] border-dashed border-ink bg-paper p-3 text-sm">
          <b>How it works.</b> Write a silly phrase. The next player draws it, the next guesses the drawing, the next draws that guess, and so on. Then watch how far each idea drifted.
        </div>
        <ul className="mt-5 grid grid-cols-4 gap-3">{game.players.map((p) => <li key={p.id}><Chip name={p.name} you={p.id === me} /></li>)}</ul>
        <div className="mt-6">
          {isHost ? <button onClick={() => send({ type: "start" })} disabled={game.players.length < MIN_PLAYERS} className={primaryButton}>{game.players.length < MIN_PLAYERS ? `Need ${MIN_PLAYERS} players (${game.players.length} here)` : "Start game"}</button> : <p className="text-center text-sm text-ink-soft">Waiting for the host to start…</p>}
        </div>
      </>
    );
  }

  if (game.phase === "reveal") {
    return (
      <>
        <h2 className="text-center font-serif text-3xl font-bold">How it went</h2>
        {game.chains?.map((chain, c) => (
          <section key={c} className="card mt-4 bg-paper p-3">
            {chain.map((page, i) => (
              <div key={i} className="mt-2 first:mt-0">
                <p className="text-xs text-ink-soft">{name(page.by)} {i === 0 ? "wrote" : i % 2 ? "drew" : "guessed"}</p>
                {i % 2 ? <Sketch strokes={page.strokes ?? []} label={`Drawing by ${name(page.by)}`} /> : <p className="font-serif text-lg font-bold">{page.text}</p>}
              </div>
            ))}
          </section>
        ))}
        <div className="mt-4">{isHost ? <button onClick={() => send({ type: "rematch" })} className={primaryButton}>Play again</button> : <p className="text-center text-sm text-ink-soft">Waiting for the host…</p>}</div>
      </>
    );
  }

  const total = game.task === "write" ? WRITE_MS : game.task === "draw" ? DRAW_MS : GUESS_MS;
  const label = `Step ${game.step + 1} of ${game.totalSteps}`;
  return (
    <>
      <Timer left={game.deadline - now} total={total} label={label} />
      {mine?.done || !game.task ? (
        <div className="mt-8 text-center">
          <p className="text-sm text-ink-soft">Waiting for the others…</p>
          <ul className="mt-4 flex flex-wrap justify-center gap-3">{game.players.map((p) => <li key={p.id}><Chip name={p.name} you={p.id === me} note={p.done ? "✓" : "…"} /></li>)}</ul>
        </div>
      ) : game.task === "draw" ? (
        <div className="mt-3" key={game.step}>
          <p className="text-center text-sm">Draw this:</p>
          <p className="mb-2 text-center font-serif text-xl font-bold">{game.incoming?.text}</p>
          <Pad onChange={(strokes) => send({ type: "submit", strokes })} onDone={(strokes) => send({ type: "submit", strokes, final: true })} />
        </div>
      ) : (
        <form
          key={game.step}
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            send({ type: "submit", text, final: true });
            setText("");
          }}
        >
          {game.task === "guess" ? <><p className="mb-2 text-center text-sm">What is this?</p><Sketch strokes={game.incoming?.strokes ?? []} label="Drawing to guess" /></> : <p className="text-center text-sm">Write something funny to draw</p>}
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              send({ type: "submit", text: e.target.value });
            }}
            maxLength={60}
            aria-label="Your words"
            placeholder={game.task === "write" ? "A cat running a bank" : "It looks like…"}
            autoComplete="off"
            className="mt-3 h-12 w-full rounded-xl border-[1.5px] border-ink bg-paper px-3"
          />
          <button disabled={!text.trim()} className={`mt-3 ${primaryButton}`}>Done</button>
        </form>
      )}
    </>
  );
}

export function DoodleRoom({ code }: { code: string }) {
  return <RoomFrame<DoodleView> party="doodle" title="Doodle Relay" bg="bg-sage" path="s" code={code} render={(room, share) => <Game room={room} share={share} />} />;
}
