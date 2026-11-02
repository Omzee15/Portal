import words from "./words.json";
import { MIN_PLAYERS, TURN_MS } from "./rules";
import { SEAT_HOLD_MS, connected, ensureHost, no, ok, shuffled, type Engine, type RoomState, type Seat } from "../party-room/core";

export type Team = "a" | "b";
export type Role = "clue" | "guess";
export type Card = "a" | "b" | "plain" | "trap";
export type HPlayer = Seat & { team: Team | null; role: Role };
export type Tile = { word: string; card: Card | null; up: boolean };
export type HState = RoomState<HPlayer> & {
  phase: "lobby" | "clue" | "guess" | "ended";
  board: { word: string; card: Card; up: boolean }[];
  turn: Team;
  clue: { word: string; count: number } | null;
  guessesLeft: number;
  deadline: number;
  winner: Team | null;
  reason: string;
};
export type HView = Omit<HState, "board"> & { board: Tile[]; left: Record<Team, number> };

const other = (t: Team): Team => (t === "a" ? "b" : "a");

export function newState(): HState {
  return { phase: "lobby", players: [], hostId: null, board: [], turn: "a", clue: null, guessesLeft: 0, deadline: 0, winner: null, reason: "" };
}

/** Everyone without a seat joins the smaller team; each team then gets exactly one clue-giver. */
function settleTeams(s: HState, rand: () => number) {
  for (const p of shuffled(s.players.filter((x) => !x.team), rand)) {
    const size = (t: Team) => s.players.filter((x) => x.team === t).length;
    p.team = size("a") <= size("b") ? "a" : "b";
    p.role = "guess";
  }
  for (const t of ["a", "b"] as Team[]) {
    const team = s.players.filter((p) => p.team === t);
    const cluers = team.filter((p) => p.role === "clue");
    if (cluers.length !== 1) {
      for (const p of team) p.role = "guess";
      if (team[0]) (cluers[0] ?? team[0]).role = "clue";
    }
  }
}

export function start(s: HState, id: string, now: number, rand: () => number = Math.random) {
  if (id !== s.hostId) return no("not_host");
  if (s.phase !== "lobby") return no("in_progress");
  if (connected(s).length < MIN_PLAYERS) return no("need_more_players");
  settleTeams(s, rand);
  if (s.players.filter((p) => p.team === "a").length < 2 || s.players.filter((p) => p.team === "b").length < 2) return no("teams_too_small");
  const first: Team = rand() < 0.5 ? "a" : "b";
  const cards: Card[] = [...Array<Card>(9).fill(first), ...Array<Card>(8).fill(other(first)), ...Array<Card>(7).fill("plain"), "trap"];
  const deal = shuffled(cards, rand);
  s.board = shuffled(words as string[], rand).slice(0, 25).map((word, i) => ({ word, card: deal[i], up: false }));
  Object.assign(s, { phase: "clue", turn: first, clue: null, guessesLeft: 0, deadline: now + TURN_MS, winner: null, reason: "" });
  return ok;
}

const remaining = (s: HState, t: Team) => s.board.filter((c) => c.card === t && !c.up).length;

function endTurn(s: HState, now: number) {
  s.turn = other(s.turn);
  s.phase = "clue";
  s.clue = null;
  s.guessesLeft = 0;
  s.deadline = now + TURN_MS;
}
function finish(s: HState, winner: Team, reason: string) {
  s.phase = "ended";
  s.winner = winner;
  s.reason = reason;
  s.deadline = 0;
}

export function giveClue(s: HState, id: string, word: unknown, count: unknown, now: number) {
  const p = s.players.find((x) => x.id === id);
  if (s.phase !== "clue") return no("not_clue_time");
  if (!p || p.team !== s.turn || p.role !== "clue") return no("not_your_clue");
  const w = String(word ?? "").trim().toLowerCase();
  const n = Number(count);
  if (!/^[a-z-]{2,20}$/.test(w)) return no("one_word_only");
  if (!Number.isInteger(n) || n < 1 || n > 9) return no("bad_count");
  if (s.board.some((c) => !c.up && (c.word === w || c.word.includes(w) || w.includes(c.word)))) return no("clue_on_board");
  s.clue = { word: w, count: n };
  s.guessesLeft = n + 1;
  s.phase = "guess";
  s.deadline = now + TURN_MS;
  return ok;
}

export function reveal(s: HState, id: string, index: unknown, now: number) {
  const p = s.players.find((x) => x.id === id);
  if (s.phase !== "guess") return no("not_guess_time");
  if (!p || p.team !== s.turn || p.role !== "guess") return no("not_your_guess");
  const card = s.board[Number(index)];
  if (!card || card.up) return no("bad_card");
  card.up = true;
  if (card.card === "trap") {
    finish(s, other(s.turn), "trap");
    return ok;
  }
  for (const t of ["a", "b"] as Team[]) if (remaining(s, t) === 0) {
    finish(s, t, "cleared");
    return ok;
  }
  if (card.card !== s.turn) endTurn(s, now);
  else if (--s.guessesLeft === 0) endTurn(s, now);
  return ok;
}

export function pass(s: HState, id: string, now: number) {
  const p = s.players.find((x) => x.id === id);
  if (s.phase !== "guess") return no("not_guess_time");
  if (!p || p.team !== s.turn || p.role !== "guess") return no("not_your_guess");
  endTurn(s, now);
  return ok;
}

export function seat(s: HState, id: string, team: unknown, role: unknown) {
  const p = s.players.find((x) => x.id === id);
  if (s.phase !== "lobby") return no("in_progress");
  if (!p || (team !== "a" && team !== "b") || (role !== "clue" && role !== "guess")) return no("bad_seat");
  if (role === "clue") for (const o of s.players) if (o.team === team && o.role === "clue") o.role = "guess";
  p.team = team;
  p.role = role;
  return ok;
}

export function rematch(s: HState, id: string) {
  if (s.phase !== "ended") return no("not_ended");
  if (id !== s.hostId) return no("not_host");
  s.players = connected(s);
  Object.assign(s, { phase: "lobby", board: [], clue: null, winner: null, reason: "" });
  ensureHost(s);
  return ok;
}

export function tick(s: HState, now: number) {
  if (s.phase === "lobby" || s.phase === "ended") return;
  // A clue-giver who has really gone hands over to a teammate, so the game can't stall.
  for (const t of ["a", "b"] as Team[]) {
    const cluer = s.players.find((p) => p.team === t && p.role === "clue");
    if (cluer && !cluer.connected && now - (cluer.disconnectedAt ?? now) >= SEAT_HOLD_MS) {
      const next = s.players.find((p) => p.team === t && p.connected);
      if (next) {
        cluer.role = "guess";
        next.role = "clue";
      }
    }
  }
  if (now >= s.deadline) endTurn(s, now);
}

export function nextWakeup(s: HState): number | null {
  return s.phase === "clue" || s.phase === "guess" ? s.deadline : null;
}

/** The key stays on the server: only clue-givers get it until a card is turned or the game ends. */
export function viewFor(s: HState, id: string): HView {
  const me = s.players.find((p) => p.id === id);
  const sees = s.phase === "ended" || me?.role === "clue";
  return {
    ...s,
    board: s.board.map((c) => ({ word: c.word, up: c.up, card: sees || c.up ? c.card : null })),
    left: { a: remaining(s, "a"), b: remaining(s, "b") },
  };
}

export const hintline: Engine<HState, HPlayer> = {
  maxPlayers: 12,
  maxMessage: 200,
  newState,
  newPlayer: (seatInfo) => ({ ...seatInfo, team: null, role: "guess" }),
  apply(s, id, m, now) {
    switch (m.type) {
      case "seat": return seat(s, id, m.team, m.role);
      case "start": return start(s, id, now);
      case "clue": return giveClue(s, id, m.word, m.count, now);
      case "reveal": return reveal(s, id, m.index, now);
      case "pass": return pass(s, id, now);
      case "rematch": return rematch(s, id);
      default: return no("unknown");
    }
  },
  tick,
  nextWakeup,
  viewFor,
};
