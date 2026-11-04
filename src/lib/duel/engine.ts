import pools from "../letterbox/answers.json";
import { MIN_PLAYERS, ROUNDS, ROUND_MS } from "./rules";
import { MAX_GUESSES, isSolved, scoreGuess, type TileState } from "../letterbox/scoring";
import { connected, ensureHost, no, ok, type Engine, type Result, type RoomState, type Seat } from "../party-room/core";

/** `pending` is a guess locked in this turn, kept hidden until everyone still guessing has one. */
export type DPlayer = Seat & { total: number; rows: { guess: string; marks: TileState[] }[]; pending: string | null };
export type DState = RoomState<DPlayer> & {
  phase: "lobby" | "racing" | "scored" | "final";
  round: number;
  answer: string;
  used: string[];
  deadline: number;
  winners: string[];
};
export type DView = Omit<DState, "answer" | "used" | "players"> & {
  answer: string | null;
  players: (Omit<DPlayer, "rows" | "pending"> & { rows: { guess: string | null; marks: TileState[] }[]; pending: string | null; locked: boolean })[];
};

export { ROUNDS } from "./rules";
const WORDS = [...pools.medium, ...pools.hard];

export const newState = (): DState => ({ phase: "lobby", players: [], hostId: null, round: 0, answer: "", used: [], deadline: 0, winners: [] });

function startRound(s: DState, now: number, rand: () => number) {
  s.round++;
  let word = WORDS[Math.floor(rand() * WORDS.length)];
  while (s.used.includes(word)) word = WORDS[Math.floor(rand() * WORDS.length)];
  s.used.push(word);
  s.answer = word;
  s.deadline = now + ROUND_MS;
  s.winners = [];
  s.phase = "racing";
  for (const p of s.players) Object.assign(p, { rows: [], pending: null });
}

export function start(s: DState, id: string, now: number, rand: () => number = Math.random): Result {
  if (id !== s.hostId) return no("not_host");
  if (s.phase !== "lobby") return no("in_progress");
  if (connected(s).length < MIN_PLAYERS) return no("need_more_players");
  s.used = [];
  s.round = 0;
  startRound(s, now, rand);
  return ok;
}

function endRound(s: DState, winners: DPlayer[]) {
  for (const w of winners) w.total++;
  s.winners = winners.map((w) => w.id);
  s.phase = "scored";
  s.deadline = 0;
}

/** Turns every locked-in guess into a row at once. Everyone who solves on the same turn shares the round. */
function reveal(s: DState) {
  const solvers: DPlayer[] = [];
  for (const p of s.players) {
    if (!p.pending) continue;
    const marks = scoreGuess(p.pending, s.answer);
    p.rows.push({ guess: p.pending, marks });
    p.pending = null;
    if (isSolved(marks)) solvers.push(p);
  }
  return solvers;
}

/** Reveals the turn once nobody still guessing is left to lock in; a player who drops out isn't waited for. */
function settle(s: DState) {
  const live = connected(s);
  if (s.phase !== "racing" || live.length === 0) return;
  const guessing = live.filter((p) => p.rows.length < MAX_GUESSES);
  if (guessing.some((p) => !p.pending)) return;
  const solvers = reveal(s);
  if (solvers.length) endRound(s, solvers);
  else if (live.every((p) => p.rows.length >= MAX_GUESSES)) endRound(s, []);
}

export function guess(s: DState, id: string, word: unknown, isWord: (w: string) => boolean): Result {
  if (s.phase !== "racing") return no("not_racing");
  const p = s.players.find((x) => x.id === id);
  if (!p || p.rows.length >= MAX_GUESSES) return no("out_of_guesses");
  if (p.pending) return no("waiting");
  const g = String(word ?? "").toLowerCase();
  if (!/^[a-z]{5}$/.test(g) || !isWord(g)) return no("not_a_word");
  p.pending = g;
  settle(s);
  return ok;
}

export function next(s: DState, id: string, now: number, rand: () => number = Math.random): Result {
  if (s.phase !== "scored") return no("not_scored");
  if (id !== s.hostId) return no("not_host");
  if (s.round >= ROUNDS) s.phase = "final";
  else startRound(s, now, rand);
  return ok;
}

export function rematch(s: DState, id: string): Result {
  if (s.phase !== "final") return no("not_final");
  if (id !== s.hostId) return no("not_host");
  s.players = connected(s);
  for (const p of s.players) Object.assign(p, { total: 0, rows: [], pending: null });
  Object.assign(s, { phase: "lobby", round: 0, answer: "", used: [], winners: [] });
  ensureHost(s);
  return ok;
}

/** Also runs when someone leaves, so the others aren't left waiting on them. At the bell, locked-in guesses still count. */
export function tick(s: DState, now: number) {
  if (s.phase !== "racing") return;
  if (now < s.deadline) return settle(s);
  endRound(s, reveal(s));
}

/** Rivals see each other's colours, never letters, and only whether a guess is locked in, not what it is. */
export function viewFor(s: DState, id: string): DView {
  const open = s.phase !== "racing";
  return {
    phase: s.phase, hostId: s.hostId, round: s.round, deadline: s.deadline, winners: s.winners ?? [],
    answer: open && s.answer ? s.answer : null,
    players: s.players.map((p) => ({
      ...p,
      rows: p.rows.map((r) => ({ marks: r.marks, guess: open || p.id === id ? r.guess : null })),
      pending: p.id === id ? p.pending : null,
      locked: !!p.pending,
    })),
  };
}

export const makeDuel = (isWord: (w: string) => boolean): Engine<DState, DPlayer> => ({
  maxPlayers: 8,
  maxMessage: 200,
  newState,
  newPlayer: (seat) => ({ ...seat, total: 0, rows: [], pending: null }),
  apply(s, id, m, now) {
    switch (m.type) {
      case "start": return start(s, id, now);
      case "guess": return guess(s, id, m.word, isWord);
      case "next": return next(s, id, now);
      case "rematch": return rematch(s, id);
      default: return no("unknown");
    }
  },
  tick,
  nextWakeup: (s) => (s.phase === "racing" ? s.deadline : null),
  viewFor,
});
