import pools from "../letterbox/answers.json";
import { MIN_PLAYERS, ROUNDS, ROUND_MS } from "./rules";
import { MAX_GUESSES, isSolved, scoreGuess, type TileState } from "../letterbox/scoring";
import { connected, ensureHost, no, ok, type Engine, type Result, type RoomState, type Seat } from "../party-room/core";

export type DPlayer = Seat & { total: number; rows: { guess: string; marks: TileState[] }[]; solved: boolean };
export type DState = RoomState<DPlayer> & {
  phase: "lobby" | "racing" | "scored" | "final";
  round: number;
  answer: string;
  used: string[];
  deadline: number;
  roundWinner: string | null;
};
export type DView = Omit<DState, "answer" | "used" | "players"> & {
  answer: string | null;
  players: (Omit<DPlayer, "rows"> & { rows: { guess: string | null; marks: TileState[] }[] })[];
};

export { ROUNDS } from "./rules";
const WORDS = [...pools.medium, ...pools.hard];

export const newState = (): DState => ({ phase: "lobby", players: [], hostId: null, round: 0, answer: "", used: [], deadline: 0, roundWinner: null });

function startRound(s: DState, now: number, rand: () => number) {
  s.round++;
  let word = WORDS[Math.floor(rand() * WORDS.length)];
  while (s.used.includes(word)) word = WORDS[Math.floor(rand() * WORDS.length)];
  s.used.push(word);
  s.answer = word;
  s.deadline = now + ROUND_MS;
  s.roundWinner = null;
  s.phase = "racing";
  for (const p of s.players) Object.assign(p, { rows: [], solved: false });
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

function endRound(s: DState, winner: DPlayer | null) {
  if (winner) winner.total++;
  s.roundWinner = winner?.id ?? null;
  s.phase = "scored";
  s.deadline = 0;
}

export function guess(s: DState, id: string, word: unknown, isWord: (w: string) => boolean): Result {
  if (s.phase !== "racing") return no("not_racing");
  const p = s.players.find((x) => x.id === id);
  if (!p || p.rows.length >= MAX_GUESSES) return no("out_of_guesses");
  const g = String(word ?? "").toLowerCase();
  if (!/^[a-z]{5}$/.test(g) || !isWord(g)) return no("not_a_word");
  const marks = scoreGuess(g, s.answer);
  p.rows.push({ guess: g, marks });
  if (isSolved(marks)) endRound(s, p);
  else if (connected(s).every((x) => x.rows.length >= MAX_GUESSES)) endRound(s, null);
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
  for (const p of s.players) Object.assign(p, { total: 0, rows: [], solved: false });
  Object.assign(s, { phase: "lobby", round: 0, answer: "", used: [], roundWinner: null });
  ensureHost(s);
  return ok;
}

export function tick(s: DState, now: number) {
  if (s.phase === "racing" && now >= s.deadline) endRound(s, null);
}

/** Rivals see each other's colours, never letters, and the word only once the round is over. */
export function viewFor(s: DState, id: string): DView {
  const open = s.phase !== "racing";
  return {
    phase: s.phase, hostId: s.hostId, round: s.round, deadline: s.deadline, roundWinner: s.roundWinner,
    answer: open && s.answer ? s.answer : null,
    players: s.players.map((p) => ({ ...p, rows: p.rows.map((r) => ({ marks: r.marks, guess: open || p.id === id ? r.guess : null })) })),
  };
}

export const makeDuel = (isWord: (w: string) => boolean): Engine<DState, DPlayer> => ({
  maxPlayers: 8,
  maxMessage: 200,
  newState,
  newPlayer: (seat) => ({ ...seat, total: 0, rows: [], solved: false }),
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
