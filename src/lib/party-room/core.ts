/**
 * What every room shares: seats, the host, and the shape of a game engine. Engines are pure and
 * take `now`, so the PartyKit server (party/room.ts) and the tests control time.
 */
export const SEAT_HOLD_MS = 60_000;

export type Seat = { id: string; name: string; connected: boolean; disconnectedAt: number | null; joinedAt: number };
export type Result = { ok: true } | { ok: false; reason: string };
export type RoomState<P extends Seat = Seat> = { phase: string; players: P[]; hostId: string | null };

export const ok: Result = { ok: true };
export const no = (reason: string): Result => ({ ok: false, reason });
export const connected = <P extends Seat>(s: RoomState<P>) => s.players.filter((p) => p.connected);

export function ensureHost<P extends Seat>(s: RoomState<P>) {
  const host = s.players.find((p) => p.id === s.hostId);
  if (host?.connected) return;
  s.hostId = connected(s).sort((a, b) => a.joinedAt - b.joinedAt)[0]?.id ?? null;
}

export type Engine<S extends RoomState<P>, P extends Seat> = {
  maxPlayers: number;
  /** longest client message accepted */
  maxMessage: number;
  newState(): S;
  newPlayer(seat: Seat): P;
  /** Applies a client message. `draft` results are saved but not broadcast. */
  apply(s: S, id: string, msg: Record<string, unknown>, now: number): Result & { quiet?: boolean };
  /** Moves clock-driven phases on. */
  tick(s: S, now: number): void;
  nextWakeup(s: S): number | null;
  viewFor(s: S, id: string): unknown;
};

export function join<S extends RoomState<P>, P extends Seat>(e: Engine<S, P>, s: S, who: { id: string; name: string }, now: number): Result {
  const name = who.name.trim().slice(0, 16) || "Player";
  const existing = s.players.find((p) => p.id === who.id);
  if (existing) {
    existing.connected = true;
    existing.disconnectedAt = null;
    if (s.phase === "lobby") existing.name = name;
    ensureHost(s);
    return ok;
  }
  if (s.phase !== "lobby") return no("in_progress");
  if (s.players.length >= e.maxPlayers) return no("room_full");
  s.players.push(e.newPlayer({ id: who.id, name, connected: true, disconnectedAt: null, joinedAt: now }));
  ensureHost(s);
  return ok;
}

export function leave<P extends Seat>(s: RoomState<P>, id: string, now: number) {
  const p = s.players.find((x) => x.id === id);
  if (!p) return;
  if (s.phase === "lobby") s.players = s.players.filter((x) => x.id !== id);
  else {
    p.connected = false;
    p.disconnectedAt = now;
  }
  ensureHost(s);
}

export function shuffled<T>(arr: readonly T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
