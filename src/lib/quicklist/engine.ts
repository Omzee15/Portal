/**
 * Quicklist: a Scattergories-style party game. Pure and server-authoritative: no I/O, no clock of its
 * own (every function takes `now`). Each round has a letter and a list of categories; players write an
 * answer starting with that letter for each. Matching answers cancel out, and the group can vote an
 * answer out in the review step.
 */

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
export const ROUNDS = 3;
export const CATEGORIES_PER_ROUND = 8;
export const WRITE_MS = 90_000;
export const REVIEW_MS = 45_000;
export const SEAT_HOLD_MS = 60_000;
export const MAX_ANSWER_LEN = 40;

// Letters that give players something to work with (no Q, U, V, X, Y, Z).
export const LETTERS = "ABCDEFGHIJKLMNOPRSTW".split("");

export const CATEGORIES = [
  "A boy's name", "A girl's name", "An Indian city", "A fruit or vegetable", "An animal",
  "A Bollywood movie", "A cricketer or sportsperson", "A street food or snack", "A brand",
  "A school subject", "Something you carry in your bag", "A job or profession",
  "A sport or game", "A country", "A river, mountain or lake", "A song", "A mobile app",
  "Something you find in a hotel room", "An excuse for being late", "A reason to cancel plans",
  "A famous person", "Something in a kitchen", "A clothing item", "A festival", "A drink",
  "Something sticky", "Something round", "Something you can break", "Something cold",
  "Something hot", "Something loud", "A thing you pack for a trip", "A body part", "A colour",
  "A vehicle", "A flower or tree", "A bird", "A dessert or sweet", "A TV show or web series",
  "Something you plug in", "Something found in a bathroom", "Something at a wedding",
  "A gift you would give", "A weather word", "A language", "Something you do at 2 a.m.",
  "A fictional character", "A place to hang out", "Something in an office", "Something you borrow",
  "Something you can fold", "A holiday destination",
];

export type Phase = "lobby" | "writing" | "review" | "results" | "final";

export type Player = {
  id: string;
  name: string;
  connected: boolean;
  disconnectedAt: number | null;
  joinedAt: number;
  total: number;
  done: boolean;
  ready: boolean;
};

export type QState = {
  phase: Phase;
  players: Player[];
  hostId: string | null;
  round: number;
  letter: string;
  categories: string[];
  deadline: number;
  /** player id -> one answer per category */
  answers: Record<string, string[]>;
  /** "ownerId:categoryIndex" -> ids of players who voted that answer out */
  flags: Record<string, string[]>;
  /** points each player scored in the round that just finished, per category */
  roundPoints: Record<string, number[]>;
  usedLetters: string[];
  usedCategories: string[];
};

export type Result = { ok: true } | { ok: false; reason: string };
const ok: Result = { ok: true };
const no = (reason: string): Result => ({ ok: false, reason });

export function newState(): QState {
  return {
    phase: "lobby", players: [], hostId: null, round: 0, letter: "", categories: [], deadline: 0,
    answers: {}, flags: {}, roundPoints: {}, usedLetters: [], usedCategories: [],
  };
}

const connected = (s: QState) => s.players.filter((p) => p.connected);

function ensureHost(s: QState) {
  const host = s.players.find((p) => p.id === s.hostId);
  if (host?.connected) return;
  s.hostId = connected(s).sort((a, b) => a.joinedAt - b.joinedAt)[0]?.id ?? null;
}

export function join(s: QState, who: { id: string; name: string }, now: number): Result {
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
  if (s.players.length >= MAX_PLAYERS) return no("room_full");
  s.players.push({ id: who.id, name, connected: true, disconnectedAt: null, joinedAt: now, total: 0, done: false, ready: false });
  ensureHost(s);
  return ok;
}

export function disconnect(s: QState, id: string, now: number) {
  const p = s.players.find((x) => x.id === id);
  if (!p) return;
  if (s.phase === "lobby") s.players = s.players.filter((x) => x.id !== id);
  else {
    p.connected = false;
    p.disconnectedAt = now;
  }
  ensureHost(s);
}

const pick = <T,>(arr: T[], n: number, rand: () => number): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
};

function startRound(s: QState, now: number, rand: () => number) {
  s.round++;
  const letters = LETTERS.filter((l) => !s.usedLetters.includes(l));
  s.letter = pick(letters, 1, rand)[0];
  s.usedLetters.push(s.letter);
  const cats = CATEGORIES.filter((c) => !s.usedCategories.includes(c));
  s.categories = pick(cats, CATEGORIES_PER_ROUND, rand);
  s.usedCategories.push(...s.categories);
  s.phase = "writing";
  s.deadline = now + WRITE_MS;
  s.answers = {};
  s.flags = {};
  s.roundPoints = {};
  for (const p of s.players) {
    s.answers[p.id] = new Array(CATEGORIES_PER_ROUND).fill("");
    p.done = false;
    p.ready = false;
  }
}

export function start(s: QState, id: string, now: number, rand: () => number = Math.random): Result {
  if (s.phase !== "lobby") return no("already_started");
  if (id !== s.hostId) return no("not_host");
  s.players = s.players.filter((p) => p.connected);
  if (s.players.length < MIN_PLAYERS) return no("need_more_players");
  for (const p of s.players) p.total = 0;
  s.round = 0;
  s.usedLetters = [];
  s.usedCategories = [];
  startRound(s, now, rand);
  return ok;
}

export function setAnswer(s: QState, id: string, cat: number, text: string): Result {
  if (s.phase !== "writing") return no("not_writing");
  const mine = s.answers[id];
  if (!mine || !Number.isInteger(cat) || cat < 0 || cat >= CATEGORIES_PER_ROUND) return no("bad_category");
  const p = s.players.find((x) => x.id === id);
  if (p?.done) return no("already_done");
  mine[cat] = text.slice(0, MAX_ANSWER_LEN);
  return ok;
}

function toReview(s: QState, now: number) {
  s.phase = "review";
  s.deadline = now + REVIEW_MS;
  for (const p of s.players) p.ready = false;
}

export function done(s: QState, id: string, now: number): Result {
  if (s.phase !== "writing") return no("not_writing");
  const p = s.players.find((x) => x.id === id);
  if (!p) return no("unknown_player");
  p.done = true;
  if (connected(s).every((x) => x.done)) toReview(s, now);
  return ok;
}

export function flag(s: QState, voterId: string, ownerId: string, cat: number): Result {
  if (s.phase !== "review") return no("not_reviewing");
  if (voterId === ownerId) return no("cannot_flag_own");
  if (!s.answers[ownerId] || !s.players.some((p) => p.id === voterId)) return no("unknown_player");
  if (!Number.isInteger(cat) || cat < 0 || cat >= CATEGORIES_PER_ROUND) return no("bad_category");
  const k = `${ownerId}:${cat}`;
  const list = s.flags[k] ?? [];
  s.flags[k] = list.includes(voterId) ? list.filter((v) => v !== voterId) : [...list, voterId];
  return ok;
}

export const normalize = (a: string) =>
  a.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().replace(/^(the|a|an) /, "").replace(/(?<=\w{3})s$/, "");

export type Verdict = "empty" | "wrong-letter" | "rejected" | "duplicate" | "unique";

/** Verdict for every player's answer in one category, as the table currently stands. */
export function judge(s: QState, cat: number): Record<string, Verdict> {
  const out: Record<string, Verdict> = {};
  const candidates: { id: string; key: string }[] = [];
  for (const p of s.players) {
    const raw = (s.answers[p.id]?.[cat] ?? "").trim();
    if (!raw) { out[p.id] = "empty"; continue; }
    if (raw[0].toUpperCase() !== s.letter) { out[p.id] = "wrong-letter"; continue; }
    // voted out by a majority of the other connected players?
    const others = s.players.filter((x) => x.connected && x.id !== p.id).length;
    const votes = (s.flags[`${p.id}:${cat}`] ?? []).filter((v) => s.players.some((x) => x.id === v && x.connected && x.id !== p.id)).length;
    if (others > 0 && votes * 2 > others) { out[p.id] = "rejected"; continue; }
    candidates.push({ id: p.id, key: normalize(raw) });
  }
  for (const c of candidates) {
    const same = candidates.filter((o) => o.key === c.key).length;
    out[c.id] = same > 1 ? "duplicate" : "unique";
  }
  return out;
}

function scoreRound(s: QState) {
  s.roundPoints = {};
  for (const p of s.players) s.roundPoints[p.id] = new Array(CATEGORIES_PER_ROUND).fill(0);
  for (let c = 0; c < CATEGORIES_PER_ROUND; c++) {
    const v = judge(s, c);
    for (const p of s.players) if (v[p.id] === "unique") s.roundPoints[p.id][c] = 1;
  }
  for (const p of s.players) p.total += s.roundPoints[p.id].reduce((a, b) => a + b, 0);
}

function toResults(s: QState) {
  scoreRound(s);
  s.phase = "results";
}

export function ready(s: QState, id: string): Result {
  if (s.phase !== "review") return no("not_reviewing");
  const p = s.players.find((x) => x.id === id);
  if (!p) return no("unknown_player");
  p.ready = true;
  if (connected(s).every((x) => x.ready)) toResults(s);
  return ok;
}

export function next(s: QState, id: string, now: number, rand: () => number = Math.random): Result {
  if (s.phase !== "results") return no("not_results");
  if (id !== s.hostId) return no("not_host");
  if (s.round >= ROUNDS) s.phase = "final";
  else startRound(s, now, rand);
  return ok;
}

export function rematch(s: QState, id: string): Result {
  if (s.phase !== "final") return no("not_final");
  if (id !== s.hostId) return no("not_host");
  s.players = s.players.filter((p) => p.connected);
  for (const p of s.players) Object.assign(p, { total: 0, done: false, ready: false });
  Object.assign(s, { phase: "lobby", round: 0, letter: "", categories: [], answers: {}, flags: {}, roundPoints: {}, usedLetters: [], usedCategories: [] });
  ensureHost(s);
  return ok;
}

/** Moves the clock-driven phases on. Returns true if anything changed. */
export function tick(s: QState, now: number): boolean {
  if (s.phase === "writing" && now >= s.deadline) {
    for (const p of s.players) p.done = true;
    toReview(s, now);
    return true;
  }
  if (s.phase === "review" && now >= s.deadline) {
    toResults(s);
    return true;
  }
  return false;
}

export function nextWakeup(s: QState): number | null {
  return s.phase === "writing" || s.phase === "review" ? s.deadline : null;
}

/** What one player is allowed to see. While writing, nobody can peek at anyone else's answers. */
export function viewFor(s: QState, id: string): QState {
  if (s.phase !== "writing") return s;
  return { ...s, answers: { [id]: s.answers[id] ?? [] }, flags: {} };
}

export function winners(s: QState): string[] {
  const top = Math.max(0, ...s.players.map((p) => p.total));
  return s.players.filter((p) => p.total === top).map((p) => p.id);
}
