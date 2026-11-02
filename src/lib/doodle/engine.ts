import { connected, ensureHost, no, ok, shuffled, type Engine, type Result, type RoomState, type Seat } from "../party-room/core";

export type Stroke = { c: string; w: number; p: number[] };
export type Page = { by: string; text?: string; strokes?: Stroke[] };
export type DoodlePlayer = Seat & { done: boolean };
export type DoodleState = RoomState<DoodlePlayer> & {
  phase: "lobby" | "playing" | "reveal";
  /** one chain per player, in seat order; each page is one player's turn on it */
  chains: Page[][];
  order: string[];
  step: number;
  deadline: number;
  drafts: Record<string, Page>;
};
export type DoodleView = Omit<DoodleState, "chains" | "drafts" | "order"> & {
  /** what you must respond to: nothing on the first step, then the page before yours */
  incoming: Page | null;
  /** "write", "draw" or "guess" */
  task: "write" | "draw" | "guess" | null;
  totalSteps: number;
  mine: Page | null;
  chains: Page[][] | null;
};

export const MIN_PLAYERS = 3;
export const WRITE_MS = 40_000;
export const DRAW_MS = 75_000;
export const GUESS_MS = 30_000;
export const MAX_POINTS = 2400;
const MAX_TEXT = 60;
const PALETTE = ["#2e2a26", "#b5533c", "#d8a93f", "#5f8a64", "#3f7a8a"];

const STARTERS = ["A cat running a bank", "Grandma on a skateboard", "A dinosaur at the dentist", "Robot falling in love", "Monday morning", "A shark ordering chai", "Sleeping through an exam", "Elephant in a tiny car", "The moon eating noodles", "A ghost doing yoga", "Pirate stuck in traffic", "Chicken crossing the road", "A very angry potato", "Wedding on a train", "Batman at the barber"];

export const newState = (): DoodleState => ({ phase: "lobby", players: [], hostId: null, chains: [], order: [], step: 0, deadline: 0, drafts: {} });

const taskAt = (step: number) => (step === 0 ? "write" : step % 2 === 1 ? "draw" : "guess");
const msFor = (step: number) => (step === 0 ? WRITE_MS : step % 2 === 1 ? DRAW_MS : GUESS_MS);
/** The chain a player works on at a step: chains move one seat along each step, so nobody sees their own twice. */
const chainFor = (s: DoodleState, id: string) => {
  const seat = s.order.indexOf(id);
  const n = s.order.length;
  return seat < 0 ? -1 : (seat - s.step + n * 2) % n;
};

export function start(s: DoodleState, id: string, now: number, rand: () => number = Math.random): Result {
  if (id !== s.hostId) return no("not_host");
  if (s.phase !== "lobby") return no("in_progress");
  if (connected(s).length < MIN_PLAYERS) return no("need_more_players");
  s.players = connected(s);
  s.order = shuffled(s.players.map((p) => p.id), rand);
  s.chains = s.order.map(() => []);
  s.drafts = {};
  s.step = 0;
  s.phase = "playing";
  s.deadline = now + msFor(0);
  for (const p of s.players) p.done = false;
  return ok;
}

function advance(s: DoodleState, now: number) {
  const task = taskAt(s.step);
  for (const id of s.order) {
    const chain = s.chains[chainFor(s, id)];
    const page = s.drafts[id];
    const empty = task === "draw" ? !page?.strokes?.length : !page?.text?.trim();
    const fallback = task === "write" ? STARTERS[Math.floor(Math.random() * STARTERS.length)] : task === "guess" ? "(no idea)" : undefined;
    chain.push(empty ? { by: id, text: fallback, strokes: task === "draw" ? [] : undefined } : page);
  }
  s.drafts = {};
  s.step++;
  for (const p of s.players) p.done = false;
  if (s.step >= s.order.length) {
    s.phase = "reveal";
    s.deadline = 0;
  } else s.deadline = now + msFor(s.step);
}

const allDone = (s: DoodleState) => {
  const here = connected(s);
  return here.length > 0 && here.every((p) => p.done);
};

function cleanStrokes(raw: unknown): Stroke[] | null {
  if (!Array.isArray(raw)) return null;
  let points = 0;
  const out: Stroke[] = [];
  for (const r of raw as Partial<Stroke>[]) {
    if (!r || !Array.isArray(r.p) || !PALETTE.includes(String(r.c)) || ![3, 8].includes(Number(r.w))) return null;
    if (!r.p.every((n) => Number.isInteger(n) && n >= 0 && n <= 320)) return null;
    points += r.p.length / 2;
    out.push({ c: String(r.c), w: Number(r.w), p: r.p });
  }
  return points <= MAX_POINTS ? out : null;
}

/** Saves work in progress. `final` also marks the player done; when the time runs out, drafts count anyway. */
export function submit(s: DoodleState, id: string, m: { text?: unknown; strokes?: unknown; final?: unknown }, now: number): Result & { quiet?: boolean } {
  const p = s.players.find((x) => x.id === id);
  if (s.phase !== "playing" || !p) return no("not_playing");
  if (taskAt(s.step) === "draw") {
    const strokes = cleanStrokes(m.strokes);
    if (!strokes) return no("bad_drawing");
    s.drafts[id] = { by: id, strokes };
  } else {
    s.drafts[id] = { by: id, text: String(m.text ?? "").trim().slice(0, MAX_TEXT) };
  }
  if (!m.final) return { ok: true, quiet: true };
  p.done = true;
  if (allDone(s)) advance(s, now);
  return ok;
}

export function rematch(s: DoodleState, id: string): Result {
  if (s.phase !== "reveal") return no("not_reveal");
  if (id !== s.hostId) return no("not_host");
  s.players = connected(s);
  Object.assign(s, { phase: "lobby", chains: [], order: [], step: 0, drafts: {} });
  ensureHost(s);
  return ok;
}

export function tick(s: DoodleState, now: number) {
  if (s.phase !== "playing") return;
  if (now >= s.deadline || allDone(s)) advance(s, now);
}

export function viewFor(s: DoodleState, id: string): DoodleView {
  const rest = { phase: s.phase, players: s.players, hostId: s.hostId, step: s.step, deadline: s.deadline };
  const playing = s.phase === "playing";
  const i = playing ? chainFor(s, id) : -1;
  return {
    ...rest,
    incoming: i >= 0 && s.step > 0 ? s.chains[i][s.step - 1] : null,
    task: playing && i >= 0 ? taskAt(s.step) : null,
    totalSteps: s.order.length,
    mine: playing ? (s.drafts[id] ?? null) : null,
    chains: s.phase === "reveal" ? s.chains : null,
  };
}

export const doodle: Engine<DoodleState, DoodlePlayer> = {
  maxPlayers: 10,
  maxMessage: 60_000,
  newState,
  newPlayer: (seat) => ({ ...seat, done: false }),
  apply(s, id, m, now) {
    switch (m.type) {
      case "start": return start(s, id, now);
      case "submit": return submit(s, id, m, now);
      case "rematch": return rematch(s, id);
      default: return no("unknown");
    }
  },
  tick,
  nextWakeup: (s) => (s.phase === "playing" ? s.deadline : null),
  viewFor,
};
export { PALETTE };
