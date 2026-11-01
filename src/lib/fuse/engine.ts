/**
 * Fuse: a pure, server-authoritative game engine. No I/O and no clock of its own:
 * every function takes `now`, so the PartyKit room (and the tests) control time.
 */

export const MAX_PLAYERS = 12;
export const MIN_PLAYERS = 2;
export const LIVES = 3;
export const SEAT_HOLD_MS = 60_000;
export const POWERUP_MS = 3_000;
export const POWERUP_MIN_STREAK = 3;

const START_TURN_MS = 10_000;
const MIN_TURN_MS = 5_000;
const SHRINK_MS = 250;

export type Player = {
  id: string;
  name: string;
  lives: number;
  out: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  joinedAt: number;
  powerups: number;
};

export type Phase = "lobby" | "playing" | "ended";

export type FuseState = {
  phase: Phase;
  players: Player[];
  hostId: string | null;
  /** id of the player whose fuse is burning */
  turnId: string | null;
  chunk: string;
  deadline: number;
  turnMs: number;
  turns: number;
  used: string[];
  winnerId: string | null;
  /** most recent thing that happened, for the UI to animate */
  last: { type: "word" | "boom" | "out"; playerId: string; word?: string } | null;
};

export type Deps = {
  isWord: (w: string) => boolean;
  pickChunk: () => string;
};

export type Result = { ok: true } | { ok: false; reason: string };

const ok: Result = { ok: true };
const no = (reason: string): Result => ({ ok: false, reason });

export function newState(): FuseState {
  return {
    phase: "lobby",
    players: [],
    hostId: null,
    turnId: null,
    chunk: "",
    deadline: 0,
    turnMs: START_TURN_MS,
    turns: 0,
    used: [],
    winnerId: null,
    last: null,
  };
}

const alive = (s: FuseState) => s.players.filter((p) => !p.out);

/** Host passes to the longest-connected player. */
function ensureHost(s: FuseState) {
  const host = s.players.find((p) => p.id === s.hostId);
  if (host && host.connected) return;
  const next = s.players
    .filter((p) => p.connected)
    .sort((a, b) => a.joinedAt - b.joinedAt)[0];
  s.hostId = next?.id ?? null;
}

export function join(
  s: FuseState,
  who: { id: string; name: string; streak: number },
  now: number,
): Result {
  const name = who.name.trim().slice(0, 16) || "Player";
  const existing = s.players.find((p) => p.id === who.id);
  if (existing) {
    // Reconnect: hold the seat, keep lives.
    existing.connected = true;
    existing.disconnectedAt = null;
    if (s.phase === "lobby") existing.name = name;
    ensureHost(s);
    return ok;
  }
  if (s.phase !== "lobby") return no("in_progress");
  if (s.players.length >= MAX_PLAYERS) return no("room_full");
  s.players.push({
    id: who.id,
    name,
    lives: LIVES,
    out: false,
    connected: true,
    disconnectedAt: null,
    joinedAt: now,
    powerups: who.streak >= POWERUP_MIN_STREAK ? 1 : 0,
  });
  ensureHost(s);
  return ok;
}

export function disconnect(s: FuseState, id: string, now: number) {
  const p = s.players.find((x) => x.id === id);
  if (!p) return;
  if (s.phase === "lobby") {
    s.players = s.players.filter((x) => x.id !== id);
  } else {
    p.connected = false;
    p.disconnectedAt = now;
  }
  ensureHost(s);
}

function nextTurn(s: FuseState, fromId: string | null, now: number, deps: Deps) {
  const live = alive(s);
  if (live.length <= 1) {
    s.phase = "ended";
    s.winnerId = live[0]?.id ?? null;
    s.turnId = null;
    return;
  }
  // Next living player after `fromId` in seating order.
  const idx = s.players.findIndex((p) => p.id === fromId);
  for (let step = 1; step <= s.players.length; step++) {
    const p = s.players[(idx + step) % s.players.length];
    if (!p.out) {
      s.turnId = p.id;
      break;
    }
  }
  s.turns++;
  s.turnMs = Math.max(MIN_TURN_MS, START_TURN_MS - Math.floor(s.turns / live.length) * SHRINK_MS);
  s.chunk = deps.pickChunk();
  s.deadline = now + s.turnMs;
}

export function start(s: FuseState, id: string, now: number, deps: Deps): Result {
  if (s.phase !== "lobby") return no("already_started");
  if (id !== s.hostId) return no("not_host");
  if (s.players.filter((p) => p.connected).length < MIN_PLAYERS) return no("need_more_players");
  s.players = s.players.filter((p) => p.connected);
  for (const p of s.players) {
    p.lives = LIVES;
    p.out = false;
  }
  s.phase = "playing";
  s.used = [];
  s.turns = 0;
  s.winnerId = null;
  s.last = null;
  nextTurn(s, s.players[s.players.length - 1].id, now, deps); // so seat 0 goes first
  return ok;
}

export function submit(s: FuseState, id: string, raw: string, now: number, deps: Deps): Result {
  if (s.phase !== "playing") return no("not_playing");
  if (s.turnId !== id) return no("not_your_turn");
  if (now >= s.deadline) return no("too_late");
  const word = raw.trim().toLowerCase();
  if (word.length < 3 || !/^[a-z]+$/.test(word)) return no("bad_word");
  if (!word.includes(s.chunk)) return no("missing_chunk");
  if (s.used.includes(word)) return no("already_used");
  if (!deps.isWord(word)) return no("not_a_word");
  s.used.push(word);
  s.last = { type: "word", playerId: id, word };
  nextTurn(s, id, now, deps);
  return ok;
}

/** The fuse burns out: the current player loses a life. Returns true if anything changed. */
export function tick(s: FuseState, now: number, deps: Deps): boolean {
  if (s.phase !== "playing" || now < s.deadline) return false;
  const p = s.players.find((x) => x.id === s.turnId);
  if (!p) return false;
  p.lives--;
  if (p.lives <= 0) {
    p.out = true;
    s.last = { type: "out", playerId: p.id };
  } else {
    s.last = { type: "boom", playerId: p.id };
  }
  nextTurn(s, p.id, now, deps);
  return true;
}

/** Drop players who stayed disconnected past the seat hold. Returns true if anything changed. */
export function reapStale(s: FuseState, now: number, deps: Deps): boolean {
  if (s.phase !== "playing") return false;
  let changed = false;
  for (const p of s.players) {
    if (!p.out && !p.connected && p.disconnectedAt !== null && now - p.disconnectedAt >= SEAT_HOLD_MS) {
      p.out = true;
      p.lives = 0;
      changed = true;
      if (s.turnId === p.id) nextTurn(s, p.id, now, deps);
      else if (alive(s).length <= 1) nextTurn(s, p.id, now, deps);
    }
  }
  return changed;
}

export function powerup(s: FuseState, id: string, now: number): Result {
  if (s.phase !== "playing") return no("not_playing");
  if (s.turnId !== id) return no("not_your_turn");
  const p = s.players.find((x) => x.id === id);
  if (!p || p.powerups < 1) return no("no_powerup");
  if (now >= s.deadline) return no("too_late");
  p.powerups--;
  s.deadline += POWERUP_MS;
  return ok;
}

export function rematch(s: FuseState, id: string): Result {
  if (s.phase !== "ended") return no("not_ended");
  if (id !== s.hostId) return no("not_host");
  s.players = s.players.filter((p) => p.connected);
  for (const p of s.players) {
    p.lives = LIVES;
    p.out = false;
  }
  s.phase = "lobby";
  s.turnId = null;
  s.winnerId = null;
  s.chunk = "";
  s.used = [];
  s.last = null;
  ensureHost(s);
  return ok;
}

/** Earliest moment the room needs to wake up and act, or null if idle. */
export function nextWakeup(s: FuseState): number | null {
  if (s.phase !== "playing") return null;
  let t = s.deadline;
  for (const p of s.players) {
    if (!p.out && !p.connected && p.disconnectedAt !== null) t = Math.min(t, p.disconnectedAt + SEAT_HOLD_MS);
  }
  return t;
}
