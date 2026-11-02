"use client";

import PartySocket from "partysocket";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GameFrame } from "@/components/GameFrame";
import { playerId, saveName, savedName } from "@/lib/identity";
import { copyText, partyHost } from "@/lib/browser";

const SKIN = ["bg-terracotta", "bg-mustard", "bg-sage", "bg-teal", "bg-mauve"];

const COMMON: Record<string, string> = {
  not_host: "Only the host can do that",
  need_more_players: "Not enough players yet",
  in_progress: "That game has already started",
  room_full: "That room is full",
};

export type Room<S> = {
  game: S;
  me: string;
  isHost: boolean;
  send: (o: object) => void;
  /** server clock, updated four times a second while a timer runs */
  now: number;
};

export function Chip({ name, you, note }: { name: string; you: boolean; note?: string }) {
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % SKIN.length;
  return (
    <div className="flex flex-col items-center">
      <div className={`font-pixel grid h-11 w-11 place-items-center rounded-2xl border-[1.5px] border-ink text-lg ${SKIN[idx]}`}>{name.slice(0, 1).toUpperCase()}</div>
      <p className="mt-1 max-w-16 truncate text-[11px] font-bold">{you ? "You" : name}</p>
      {note && <p className="text-[11px] leading-none">{note}</p>}
    </div>
  );
}

export function Timer({ left, total, label }: { left: number; total: number; label: string }) {
  const frac = Math.min(1, Math.max(0, left / total));
  return (
    <>
      <div className="flex items-center justify-between text-sm">
        <b>{label}</b>
        <span className="font-pixel">{Math.ceil(Math.max(0, left) / 1000)}s</span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full border-[1.5px] border-ink bg-paper" role="progressbar" aria-label={label} aria-valuenow={Math.round(frac * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full origin-left ${left < 10_000 ? "bg-brick" : "bg-mustard"}`} style={{ transform: `scaleX(${frac})`, transition: "transform 250ms linear" }} />
      </div>
    </>
  );
}

export const primaryButton = "h-12 w-full rounded-full border-[1.5px] border-ink bg-ink font-bold text-paper disabled:opacity-50 active:scale-[0.97]";

/** Everything rooms have in common: the name prompt, the socket, reconnecting, the header and the share code. */
export function RoomFrame<S extends { phase: string; hostId: string | null }>({
  party, title, bg, path, code, reasons, render,
}: {
  party: string;
  title: string;
  bg: string;
  path: string;
  code: string;
  reasons?: Record<string, string>;
  render: (room: Room<S>, share: ReactNode) => ReactNode;
}) {
  const [name, setName] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [game, setGame] = useState<S | null>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "reconnecting" | "refused">("connecting");
  const [refusal, setRefusal] = useState<string>();
  const [toast, setToast] = useState<string>();
  const [now, setNow] = useState(0);
  const [copied, setCopied] = useState(false);
  const offset = useRef(0);
  const sock = useRef<PartySocket | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const me = useMemo(() => (typeof window === "undefined" ? "" : playerId()), []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring the saved name; localStorage is unavailable during SSR
  useEffect(() => setName(savedName() || ""), []);

  useEffect(() => {
    if (!name) return;
    const ws = new PartySocket({ host: partyHost(), party, room: code, query: { pid: me, name } });
    sock.current = ws;
    ws.addEventListener("open", () => setStatus("open"));
    ws.addEventListener("close", (e) => setStatus((s) => (e.code === 4001 || s === "refused" ? "refused" : "reconnecting")));
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data as string);
      if (m.type === "state") {
        offset.current = m.serverNow - Date.now();
        setGame(m.state as S);
      } else if (m.type === "rejected") {
        if (m.reason === "in_progress" || m.reason === "room_full") return setRefusal(m.reason);
        setToast(reasons?.[m.reason] ?? COMMON[m.reason] ?? "Not allowed");
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(undefined), 1700);
      }
    });
    return () => ws.close();
  }, [name, code, me, party, reasons]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset.current), 250);
    return () => clearInterval(t);
  }, []);

  const send = useCallback((o: object) => sock.current?.send(JSON.stringify(o)), []);

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
          <button className={`mt-4 ${primaryButton}`}>Join</button>
        </form>
      </GameFrame>
    );
  }

  if (status === "refused") {
    return (
      <GameFrame>
        <div className="p-6 text-center">
          <h1 className="font-serif text-2xl font-bold">Can&apos;t join this room</h1>
          <p className="mt-2 text-sm">{COMMON[refusal ?? ""] ?? "This room isn't available."}</p>
          <Link href="/party" className="mt-4 block underline">Back to Party</Link>
        </div>
      </GameFrame>
    );
  }

  const copy = async () => {
    const link = `${location.origin}/${path}/${code}`;
    try {
      if (navigator.share) await navigator.share({ title: `${title} on Portal`, text: `Join my ${title} room ${code}`, url: link });
      else {
        await copyText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* dismissed */
    }
  };

  const share = (
    <>
      <p className="text-center text-xs text-ink-soft">Share this code or link</p>
      <button onPointerDown={copy} className="font-pixel mx-auto mt-1 block rounded-2xl border-[1.5px] border-dashed border-ink bg-paper px-6 py-3 text-4xl tracking-[0.3em]">{code}</button>
      <p className="mt-1 text-center text-xs text-ink-soft">{copied ? "Link copied" : "Tap to share the invite link"}</p>
    </>
  );

  return (
    <GameFrame>
      <header className={`flex items-center justify-between border-b-[1.5px] border-ink px-3 py-2 ${bg}`}>
        <Link href="/party" aria-label="Leave room" className="grid h-11 w-11 place-items-center rounded-xl border-[1.5px] border-ink bg-paper">×</Link>
        <div className="text-center">
          <h1 className="font-serif text-lg font-bold leading-none">{title}</h1>
          <p className="font-pixel text-[10px]">ROOM {code}</p>
        </div>
        <button onPointerDown={copy} aria-label="Share invite link" className="grid h-11 w-11 place-items-center rounded-xl border-[1.5px] border-ink bg-paper text-sm">{copied ? "✓" : "↗"}</button>
      </header>
      {status === "reconnecting" && <p role="status" className="bg-brick px-3 py-1 text-center text-xs font-bold text-paper">Reconnecting… your seat is held for 60 seconds</p>}
      <div className="relative min-h-[calc(100dvh-56px)] bg-paper-deep/60 p-4 md:min-h-[600px]">
        {toast && <span role="status" className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper">{toast}</span>}
        {/* eslint-disable-next-line react-hooks/refs -- send only touches the socket when a player acts, never during render */}
        {game ? render({ game, me, isHost: game.hostId === me, send, now }, share) : <p className="p-8 text-center text-sm text-ink-soft">{status === "reconnecting" ? "Reconnecting…" : "Joining…"}</p>}
      </div>
    </GameFrame>
  );
}
