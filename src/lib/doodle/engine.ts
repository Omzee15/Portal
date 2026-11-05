import WORDS from "./words.json";
import { maskBadWords } from "../name-filter";
import { connected, ensureHost, no, ok, shuffled, type Engine, type Result, type RoomState, type Seat } from "../party-room/core";
import { CHOOSE_MS, MAX_CHAT, MAX_PLAYERS, MAX_POINTS, MIN_PLAYERS, PALETTE, REVEAL_MS, ROUND_CHOICES, TIME_CHOICES, WIDTHS, type Stroke } from "./rules";

/**
 * Take turns drawing a word while everyone else guesses it in the chat, like skribbl.io. Faster guesses
 * score more, and the drawer scores for every player who gets it. Letters of the word appear as hints
 * while time runs down.
 */
export type DoodlePlayer = Seat & { score: number; gained: number; guessedAt: number | null };
/** `to` keeps a message to one player; `inner` ones are only for the drawer and players who already guessed. */
export type Msg = { n: number; by: string | null; text: string; kind: "chat" | "inner" | "correct" | "close" | "system"; to?: string };
export type DoodleState = RoomState<DoodlePlayer> & {
  phase: "lobby" | "choosing" | "drawing" | "turnEnd" | "final";
  rounds: number;
  drawMs: number;
  round: number;
  order: string[];
  turn: number;
  drawer: string | null;
  choices: string[];
  word: string;
  /** letter positions in the order they're given away, and how many are showing */
  hints: number[];
  shown: number;
  startedAt: number;
  deadline: number;
  strokes: Stroke[];
  chat: Msg[];
  used: string[];
};
export type DoodleView = Omit<DoodleState, "word" | "choices" | "hints" | "order" | "used" | "chat" | "players"> & {
  /** the word in full, or blanks with any hinted letters: "_ a _ _" */
  word: string;
  choices: string[];
  chat: Msg[];
  players: (Omit<DoodlePlayer, "guessedAt"> & { guessed: boolean })[];
};

const HISTORY = 40;
/** A reload drops the connection for a moment, so nobody counts as gone until this passes. */
export const GRACE_MS = 10_000;
const TIERS = [WORDS.easy, WORDS.medium, WORDS.hard];

export const newState = (): DoodleState => ({
  phase: "lobby", players: [], hostId: null, rounds: 3, drawMs: 80_000, round: 0, order: [], turn: -1, drawer: null,
  choices: [], word: "", hints: [], shown: 0, startedAt: 0, deadline: 0, strokes: [], chat: [], used: [],
});

const words = (t: string) => t.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const squash = (t: string) => words(t).replace(/ /g, "");

function distance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

/** Right if the word is the whole message or said inside it ("is it a cat"), close if it's one slip away. */
export function judgeGuess(text: string, word: string): "right" | "close" | "wrong" {
  if (squash(text) === squash(word) || ` ${words(text)} `.includes(` ${words(word)} `)) return "right";
  const a = squash(text), b = squash(word);
  return b.length >= 4 && distance(a, b) === 1 ? "close" : "wrong";
}

function say(s: DoodleState, m: Omit<Msg, "n">) {
  s.chat.push({ n: (s.chat.at(-1)?.n ?? 0) + 1, ...m });
  if (s.chat.length > HISTORY) s.chat.splice(0, s.chat.length - HISTORY);
}

const present = (p: DoodlePlayer | undefined, now: number) => !!p && (p.connected || now - (p.disconnectedAt ?? 0) < GRACE_MS);
const guessers = (s: DoodleState, now: number) => s.players.filter((p) => p.id !== s.drawer && present(p, now));
const hintTimes = (s: DoodleState) => s.hints.map((_, i) => s.startedAt + s.drawMs * (0.5 + 0.2 * i));
const name = (s: DoodleState, id: string | null) => s.players.find((p) => p.id === id)?.name ?? "Someone";

function pick(s: DoodleState, rand: () => number) {
  return TIERS.map((tier) => {
    const fresh = tier.filter((w) => !s.used.includes(w));
    const pool = fresh.length ? fresh : tier;
    return pool[Math.floor(rand() * pool.length)];
  });
}

/** Hands the pen to the next connected player, moving to the next round after everyone has drawn. */
function nextTurn(s: DoodleState, now: number, rand: () => number) {
  for (let tries = 0; tries <= s.order.length * s.rounds; tries++) {
    s.turn++;
    if (s.turn >= s.order.length) {
      s.turn = 0;
      s.round++;
    }
    if (s.round > s.rounds) break;
    const drawer = s.players.find((p) => p.id === s.order[s.turn]);
    if (!drawer?.connected) continue;
    for (const p of s.players) Object.assign(p, { gained: 0, guessedAt: null });
    Object.assign(s, { phase: "choosing", drawer: drawer.id, choices: pick(s, rand), word: "", hints: [], shown: 0, strokes: [], deadline: now + CHOOSE_MS });
    return;
  }
  Object.assign(s, { phase: "final", drawer: null, choices: [], word: "", strokes: [], deadline: 0 });
}

export function configure(s: DoodleState, id: string, m: { rounds?: unknown; drawMs?: unknown }): Result {
  if (s.phase !== "lobby") return no("in_progress");
  if (id !== s.hostId) return no("not_host");
  const rounds = Number(m.rounds ?? s.rounds), drawMs = Number(m.drawMs ?? s.drawMs);
  if (!ROUND_CHOICES.includes(rounds) || !TIME_CHOICES.includes(drawMs)) return no("bad_settings");
  Object.assign(s, { rounds, drawMs });
  return ok;
}

export function start(s: DoodleState, id: string, now: number, rand: () => number = Math.random): Result {
  if (id !== s.hostId) return no("not_host");
  if (s.phase !== "lobby") return no("in_progress");
  if (connected(s).length < MIN_PLAYERS) return no("need_more_players");
  s.players = connected(s);
  for (const p of s.players) p.score = 0;
  Object.assign(s, { order: shuffled(s.players.map((p) => p.id), rand), round: 1, turn: -1, used: [], chat: [] });
  nextTurn(s, now, rand);
  return ok;
}

export function choose(s: DoodleState, id: string, index: unknown, now: number, rand: () => number = Math.random): Result {
  if (s.phase !== "choosing") return no("not_choosing");
  if (id !== s.drawer) return no("not_drawer");
  const word = s.choices[Number(index)];
  if (!word) return no("bad_choice");
  const letters = [...word].map((c, i) => (c === " " ? -1 : i)).filter((i) => i >= 0);
  // Give away a letter on words of 4+, and a second on words of 7+, but never most of the word.
  const count = letters.length >= 7 ? 2 : letters.length >= 4 ? 1 : 0;
  s.used.push(word);
  Object.assign(s, { phase: "drawing", word, choices: [], hints: shuffled(letters, rand).slice(0, count), shown: 0, startedAt: now, deadline: now + s.drawMs });
  return ok;
}

function cleanStrokes(raw: unknown): Stroke[] | null {
  if (!Array.isArray(raw)) return null;
  let points = 0;
  const out: Stroke[] = [];
  for (const r of raw as Partial<Stroke>[]) {
    if (!r || !Array.isArray(r.p) || r.p.length % 2 || !PALETTE.includes(String(r.c)) || !WIDTHS.includes(Number(r.w))) return null;
    if (!r.p.every((n) => Number.isInteger(n) && n >= 0 && n <= 320)) return null;
    points += r.p.length / 2;
    out.push({ c: String(r.c), w: Number(r.w), p: r.p });
  }
  return points <= MAX_POINTS ? out : null;
}

/** The drawer sends the whole picture each time, so a dropped message just means the next one catches up. */
export function draw(s: DoodleState, id: string, raw: unknown): Result {
  if (s.phase !== "drawing") return no("not_drawing");
  if (id !== s.drawer) return no("not_drawer");
  const strokes = cleanStrokes(raw);
  if (!strokes) return no("bad_drawing");
  s.strokes = strokes;
  return ok;
}

function endTurn(s: DoodleState, now: number) {
  const all = s.players.filter((p) => p.id !== s.drawer);
  const got = all.filter((p) => p.guessedAt !== null).length;
  const drawer = s.players.find((p) => p.id === s.drawer);
  if (drawer && all.length) drawer.gained = Math.round((300 * got) / all.length);
  for (const p of s.players) p.score += p.gained;
  say(s, { by: null, kind: "system", text: `The word was ${s.word}` });
  Object.assign(s, { phase: "turnEnd", deadline: now + REVEAL_MS, shown: s.hints.length });
}

export function chat(s: DoodleState, id: string, raw: unknown, now: number): Result {
  const p = s.players.find((x) => x.id === id);
  const typed = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CHAT);
  if (!p || !typed) return no("empty");
  // guesses are judged on what was typed; everyone sees the cleaned-up version
  const text = maskBadWords(typed);
  if (s.phase !== "drawing") return say(s, { by: id, kind: "chat", text }), ok;
  // The drawer and anyone who has it can talk, but only among themselves, so the word can't slip out.
  if (id === s.drawer || p.guessedAt !== null) return say(s, { by: id, kind: "inner", text }), ok;
  const verdict = judgeGuess(typed, s.word);
  if (verdict === "right") {
    p.guessedAt = now;
    p.gained = Math.round(50 + (450 * Math.max(0, s.deadline - now)) / s.drawMs);
    say(s, { by: id, kind: "correct", text: `${p.name} guessed the word!` });
    if (guessers(s, now).every((g) => g.guessedAt !== null)) endTurn(s, now);
    return ok;
  }
  say(s, { by: id, kind: "chat", text });
  if (verdict === "close") say(s, { by: null, kind: "close", text: `"${text}" is close!`, to: id });
  return ok;
}

export function rematch(s: DoodleState, id: string): Result {
  if (s.phase !== "final") return no("not_final");
  if (id !== s.hostId) return no("not_host");
  s.players = connected(s);
  for (const p of s.players) Object.assign(p, { score: 0, gained: 0, guessedAt: null });
  Object.assign(s, { phase: "lobby", round: 0, turn: -1, order: [], drawer: null, strokes: [], chat: [], used: [] });
  ensureHost(s);
  return ok;
}

export function tick(s: DoodleState, now: number, rand: () => number = Math.random) {
  // Everyone off at once is a server restart or a lost connection, not a group leaving, so wait for them.
  if (connected(s).length === 0) return;
  const drawerGone = !present(s.players.find((p) => p.id === s.drawer), now);
  if (s.phase === "choosing") {
    if (drawerGone) {
      say(s, { by: null, kind: "system", text: `${name(s, s.drawer)} left, so their turn is skipped` });
      nextTurn(s, now, rand);
    } else if (now >= s.deadline) choose(s, s.drawer!, Math.floor(rand() * s.choices.length), now, rand);
  } else if (s.phase === "drawing") {
    s.shown = hintTimes(s).filter((t) => t <= now).length;
    if (now >= s.deadline || drawerGone || guessers(s, now).every((g) => g.guessedAt !== null)) endTurn(s, now);
  } else if (s.phase === "turnEnd" && now >= s.deadline) nextTurn(s, now, rand);
}

export function viewFor(s: DoodleState, id: string): DoodleView {
  const me = s.players.find((p) => p.id === id);
  const knows = s.phase === "turnEnd" || id === s.drawer || me?.guessedAt != null;
  const hinted = new Set(s.hints.slice(0, s.shown));
  const word = knows ? s.word : [...s.word].map((c, i) => (c === " " ? " " : hinted.has(i) ? c : "_")).join("");
  return {
    phase: s.phase, hostId: s.hostId, rounds: s.rounds, drawMs: s.drawMs, round: s.round, turn: s.turn, drawer: s.drawer,
    shown: s.shown, startedAt: s.startedAt, deadline: s.deadline, strokes: s.strokes, word,
    choices: id === s.drawer ? s.choices : [],
    chat: s.chat.filter((m) => (m.to ? m.to === id : m.kind !== "inner" || knows)),
    players: s.players.map(({ guessedAt, ...p }) => ({ ...p, guessed: guessedAt !== null })),
  };
}

export const doodle: Engine<DoodleState, DoodlePlayer> = {
  maxPlayers: MAX_PLAYERS,
  maxMessage: 60_000,
  newState,
  newPlayer: (seat) => ({ ...seat, score: 0, gained: 0, guessedAt: null }),
  apply(s, id, m, now) {
    switch (m.type) {
      case "configure": return configure(s, id, m);
      case "start": return start(s, id, now);
      case "choose": return choose(s, id, m.index, now);
      case "draw": return draw(s, id, m.strokes);
      case "chat": return chat(s, id, m.text, now);
      case "rematch": return rematch(s, id);
      default: return no("unknown");
    }
  },
  tick: (s, now) => tick(s, now),
  nextWakeup: (s) => {
    if (s.phase === "turnEnd") return s.deadline;
    if (s.phase !== "choosing" && s.phase !== "drawing") return null;
    // A drawer who doesn't come back loses the turn, which moves the game on, so this can't fire twice.
    const drawer = s.players.find((p) => p.id === s.drawer);
    const gone = drawer && !drawer.connected && drawer.disconnectedAt !== null ? [drawer.disconnectedAt + GRACE_MS] : [];
    const hints = s.phase === "drawing" ? hintTimes(s).slice(s.shown) : [];
    return Math.min(s.deadline, ...hints, ...gone);
  },
  viewFor,
};
