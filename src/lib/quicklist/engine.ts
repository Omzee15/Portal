/**
 * Quicklist: a Scattergories-style party game. Pure and server-authoritative: no I/O, no clock of its
 * own (every function takes `now`). Each round has a letter and a list of categories; players write an
 * answer starting with that letter for each, and the first player to press done ends the writing for
 * everyone. Matching answers cancel out. Answers on the category's list count unless the group votes
 * them out; anything else scores only if the group accepts it. Review has no clock.
 */

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
export const ROUNDS = 3;
export const CATEGORIES_PER_ROUND = 8;
export const WRITE_MS = 90_000;
/** What the host can pick in the lobby. */
export const ROUND_CHOICES = [3, 4, 5, 6];
export const TIMER_CHOICES = [60_000, 90_000, 120_000, 180_000];
/** Nobody can end a round in its first half minute, so one quick tap doesn't cut everyone off. */
export const MIN_WRITE_MS = 30_000;
export const SEAT_HOLD_MS = 60_000;
export const MAX_ANSWER_LEN = 40;

// Letters that give players something to work with (no Q, U, V, X, Y, Z).
export const LETTERS = "ABCDEFGHIJKLMNOPRSTW".split("");

export const CATEGORIES = [
  "A boy's name",
  "A girl's name",
  "An Indian city",
  "A fruit or vegetable",
  "An animal",
  "A Bollywood movie",
  "A cricketer or sportsperson",
  "A street food or snack",
  "A brand",
  "A school subject",
  "A job or profession",
  "A sport or game",
  "A country",
  "A river, mountain or lake",
  "A mobile app",
  "A clothing item",
  "A festival",
  "A drink",
  "A body part",
  "A colour",
  "A vehicle",
  "A flower or tree",
  "A bird",
  "A dessert or sweet",
  "A TV show or web series",
  "A language",
  "A famous person",
  "A fictional character",
  "A holiday destination",
  "An Indian state",
  "A world city",
  "A South Indian dish",
  "A North Indian dish",
  "A spice or masala",
  "Something at a kirana store",
  "A Bollywood actor or actress",
  "A singer or music band",
  "A Hollywood movie",
  "A god, goddess or holy figure",
  "A Ramayan or Mahabharat character",
  "Something in the kitchen",
  "Something in a bathroom",
  "Something in a classroom or school bag",
  "Something in an office",
  "Something you plug in",
  "A piece of furniture",
  "Something at an Indian wedding",
  "Something you pack for a trip",
  "A musical instrument",
  "A tool",
  "A car or bike brand",
  "An IPL team or cricket term",
  "An insect or creepy crawly",
  "A sea creature",
  "A metal, gem or mineral",
  "A cartoon or anime",
  "A weather or nature word",
  "A shop or food chain in a mall",
  "A freedom fighter or Indian leader",
  "A Hindi serial or reality show",
  "An Indian bread, rice or dal",
  "A family relation in Hindi or English",
  "An Indian dance or art form",
  "Indian jewellery or makeup",
  "A course, degree or exam",
];

/** Too alike to appear in the same round, so a round doesn't feel like one question asked twice. */
export const FAMILIES = [
  ["A cricketer or sportsperson", "A famous person", "A Bollywood actor or actress", "A singer or music band", "A freedom fighter or Indian leader"],
  ["A Bollywood movie", "A Hollywood movie", "A TV show or web series", "A Hindi serial or reality show", "A cartoon or anime"],
  ["A fictional character", "A Ramayan or Mahabharat character", "A god, goddess or holy figure"],
  ["A fruit or vegetable", "A South Indian dish", "A North Indian dish", "A street food or snack", "A dessert or sweet", "An Indian bread, rice or dal", "A drink", "A spice or masala"],
  ["An animal", "A bird", "An insect or creepy crawly", "A sea creature"],
  ["An Indian city", "An Indian state", "A world city", "A country", "A holiday destination", "A river, mountain or lake"],
  ["A brand", "A car or bike brand", "A shop or food chain in a mall", "A mobile app"],
  ["Something in the kitchen", "Something in a bathroom", "Something in a classroom or school bag", "Something in an office", "Something you plug in", "A piece of furniture", "Something at a kirana store", "A tool", "Something you pack for a trip"],
  ["A clothing item", "Indian jewellery or makeup", "Something at an Indian wedding"],
  ["A boy's name", "A girl's name", "A family relation in Hindi or English"],
  ["A sport or game", "An IPL team or cricket term"],
  ["A festival", "An Indian dance or art form"],
  ["A language", "A school subject", "A course, degree or exam"],
];

const family = (c: string) => FAMILIES.find((f) => f.includes(c)) ?? [c];

export type Phase = "lobby" | "writing" | "review" | "results" | "final";

export type Player = {
  id: string;
  name: string;
  connected: boolean;
  disconnectedAt: number | null;
  joinedAt: number;
  total: number;
  ready: boolean;
};

/** A finished round, kept so the results can show where every point came from. */
export type RoundRecord = {
  letter: string;
  categories: string[];
  answers: Record<string, string[]>;
  verdicts: Record<string, Verdict[]>;
};

export type QState = {
  phase: Phase;
  players: Player[];
  hostId: string | null;
  round: number;
  letter: string;
  categories: string[];
  deadline: number;
  /** when the current round's writing began */
  startedAt: number;
  rounds: number;
  writeMs: number;
  history: RoundRecord[];
  /** player id -> one answer per category */
  answers: Record<string, string[]>;
  /**
   * "ownerId:categoryIndex" -> ids of the players who voted on that answer: to throw it out if it's on
   * the category's list, to accept it if it isn't.
   */
  flags: Record<string, string[]>;
  /** "ownerId:categoryIndex" -> the listed answer it was recognised as */
  known: Record<string, string>;
  /** points each player scored in the round that just finished, per category */
  roundPoints: Record<string, number[]>;
  usedLetters: string[];
  usedCategories: string[];
};

/** The listed answer this one means, or null. Passed in so the lists stay out of the browser. */
export type Check = (category: string, answer: string) => string | null;

export type Result = { ok: true } | { ok: false; reason: string };
const ok: Result = { ok: true };
const no = (reason: string): Result => ({ ok: false, reason });

export function newState(): QState {
  return {
    phase: "lobby", players: [], hostId: null, round: 0, letter: "", categories: [], deadline: 0, startedAt: 0,
    rounds: ROUNDS, writeMs: WRITE_MS, history: [],
    answers: {}, flags: {}, known: {}, roundPoints: {}, usedLetters: [], usedCategories: [],
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
  s.players.push({ id: who.id, name, connected: true, disconnectedAt: null, joinedAt: now, total: 0, ready: false });
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

/** Unused questions, no two from one family unless the pool is too thin to manage that. */
function dealCategories(used: string[], rand: () => number) {
  const fresh = pick(CATEGORIES.filter((c) => !used.includes(c)), CATEGORIES.length, rand);
  const round: string[] = [];
  for (const c of fresh) if (round.length < CATEGORIES_PER_ROUND && !round.some((r) => family(c).includes(r))) round.push(c);
  for (const c of fresh) if (round.length < CATEGORIES_PER_ROUND && !round.includes(c)) round.push(c);
  return round;
}

function startRound(s: QState, now: number, rand: () => number) {
  s.round++;
  const letters = LETTERS.filter((l) => !s.usedLetters.includes(l));
  s.letter = pick(letters, 1, rand)[0];
  s.usedLetters.push(s.letter);
  // Questions don't come back until the whole pool has been used, even across rematches.
  if (CATEGORIES.length - s.usedCategories.length < CATEGORIES_PER_ROUND) s.usedCategories = [];
  s.categories = dealCategories(s.usedCategories, rand);
  s.usedCategories.push(...s.categories);
  s.phase = "writing";
  s.startedAt = now;
  s.deadline = now + s.writeMs;
  s.answers = {};
  s.flags = {};
  s.known = {};
  s.roundPoints = {};
  for (const p of s.players) {
    s.answers[p.id] = new Array(CATEGORIES_PER_ROUND).fill("");
    p.ready = false;
  }
}

export function configure(s: QState, id: string, settings: { rounds?: unknown; writeMs?: unknown }): Result {
  if (s.phase !== "lobby") return no("already_started");
  if (id !== s.hostId) return no("not_host");
  const rounds = Number(settings.rounds ?? s.rounds), writeMs = Number(settings.writeMs ?? s.writeMs);
  if (!ROUND_CHOICES.includes(rounds) || !TIMER_CHOICES.includes(writeMs)) return no("bad_settings");
  Object.assign(s, { rounds, writeMs });
  return ok;
}

export function start(s: QState, id: string, now: number, rand: () => number = Math.random): Result {
  if (s.phase !== "lobby") return no("already_started");
  if (id !== s.hostId) return no("not_host");
  s.players = s.players.filter((p) => p.connected);
  if (s.players.length < MIN_PLAYERS) return no("need_more_players");
  for (const p of s.players) p.total = 0;
  s.round = 0;
  s.usedLetters = [];
  s.history = [];
  startRound(s, now, rand);
  return ok;
}

export function setAnswer(s: QState, id: string, cat: number, text: string): Result {
  if (s.phase !== "writing") return no("not_writing");
  const mine = s.answers[id];
  if (!mine || !Number.isInteger(cat) || cat < 0 || cat >= CATEGORIES_PER_ROUND) return no("bad_category");
  mine[cat] = text.slice(0, MAX_ANSWER_LEN);
  return ok;
}

function toReview(s: QState, check: Check) {
  for (const p of s.players) {
    s.categories.forEach((c, i) => {
      const hit = check(c, (s.answers[p.id]?.[i] ?? "").trim());
      if (hit) s.known[`${p.id}:${i}`] = hit;
    });
  }
  s.phase = "review";
  s.deadline = 0;
  for (const p of s.players) p.ready = false;
}

/** One player finishing finishes the round for everybody, whatever they have written so far. */
export function done(s: QState, id: string, now: number, check: Check): Result {
  if (s.phase !== "writing") return no("not_writing");
  if (!s.players.some((x) => x.id === id)) return no("unknown_player");
  if (now < s.startedAt + MIN_WRITE_MS) return no("too_soon");
  toReview(s, check);
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

/** "The Office" counts for T or O. */
export const startsWith = (answer: string, letter: string) =>
  answer[0].toUpperCase() === letter || normalize(answer)[0]?.toUpperCase() === letter;

export type Verdict = "empty" | "wrong-letter" | "rejected" | "unconfirmed" | "duplicate" | "unique";

/** Verdict for every player's answer in one category, as the table currently stands. */
export function judge(s: QState, cat: number): Record<string, Verdict> {
  const out: Record<string, Verdict> = {};
  const candidates: { id: string; key: string }[] = [];
  for (const p of s.players) {
    const raw = (s.answers[p.id]?.[cat] ?? "").trim();
    if (!raw) { out[p.id] = "empty"; continue; }
    if (!startsWith(raw, s.letter)) { out[p.id] = "wrong-letter"; continue; }
    const others = s.players.filter((x) => x.connected && x.id !== p.id).length;
    const votes = (s.flags[`${p.id}:${cat}`] ?? []).filter((v) => s.players.some((x) => x.id === v && x.connected && x.id !== p.id)).length;
    const listed = s.known[`${p.id}:${cat}`];
    // on the list: a majority of the others can throw it out. Not on it: half of them must accept it.
    if (listed && others > 0 && votes * 2 > others) { out[p.id] = "rejected"; continue; }
    if (!listed && (others === 0 || votes * 2 < others)) { out[p.id] = "unconfirmed"; continue; }
    candidates.push({ id: p.id, key: listed ?? normalize(raw) });
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
  const verdicts: Record<string, Verdict[]> = {};
  const all = s.categories.map((_, c) => judge(s, c));
  for (const p of s.players) verdicts[p.id] = all.map((v) => v[p.id] ?? "empty");
  s.history.push({ letter: s.letter, categories: [...s.categories], answers: structuredClone(s.answers), verdicts });
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

/** Lets the host move on if someone wandered off without pressing ready. */
export function reveal(s: QState, id: string): Result {
  if (s.phase !== "review") return no("not_reviewing");
  if (id !== s.hostId) return no("not_host");
  toResults(s);
  return ok;
}

export function next(s: QState, id: string, now: number, rand: () => number = Math.random): Result {
  if (s.phase !== "results") return no("not_results");
  if (id !== s.hostId) return no("not_host");
  if (s.round >= s.rounds) s.phase = "final";
  else startRound(s, now, rand);
  return ok;
}

export function rematch(s: QState, id: string): Result {
  if (s.phase !== "final") return no("not_final");
  if (id !== s.hostId) return no("not_host");
  s.players = s.players.filter((p) => p.connected);
  for (const p of s.players) Object.assign(p, { total: 0, ready: false });
  Object.assign(s, { phase: "lobby", round: 0, letter: "", categories: [], answers: {}, flags: {}, known: {}, roundPoints: {}, usedLetters: [], history: [] });
  ensureHost(s);
  return ok;
}

/** Moves the clock-driven phases on. Returns true if anything changed. */
export function tick(s: QState, now: number, check: Check): boolean {
  if (s.phase === "writing" && now >= s.deadline) {
    toReview(s, check);
    return true;
  }
  return false;
}

export function nextWakeup(s: QState): number | null {
  return s.phase === "writing" ? s.deadline : null;
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
