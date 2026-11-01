import { beforeEach, describe, expect, it } from "vitest";
import {
  disconnect, join, LIVES, newState, nextWakeup, powerup, reapStale, rematch, SEAT_HOLD_MS,
  start, submit, tick, type Deps, type FuseState,
} from "./engine";

const WORDS = new Set(["singing", "running", "ring", "bring", "string"]);
const deps: Deps = { isWord: (w) => WORDS.has(w), pickChunk: () => "ing" };

let s: FuseState;
const add = (id: string, t = 0, streak = 0) => join(s, { id, name: id, streak }, t);

beforeEach(() => {
  s = newState();
});

describe("lobby", () => {
  it("first joiner is host; host passes on when they leave", () => {
    add("a", 1);
    add("b", 2);
    expect(s.hostId).toBe("a");
    disconnect(s, "a", 10);
    expect(s.hostId).toBe("b");
    expect(s.players.map((p) => p.id)).toEqual(["b"]);
  });

  it("needs a host and two connected players to start", () => {
    add("a");
    expect(start(s, "a", 0, deps)).toEqual({ ok: false, reason: "need_more_players" });
    add("b");
    expect(start(s, "b", 0, deps)).toEqual({ ok: false, reason: "not_host" });
    expect(start(s, "a", 0, deps).ok).toBe(true);
  });

  it("caps the room at 12 and refuses newcomers mid-game", () => {
    for (let i = 0; i < 12; i++) add(`p${i}`);
    expect(add("extra")).toEqual({ ok: false, reason: "room_full" });
    start(s, "p0", 0, deps);
    s = { ...s, players: s.players };
    expect(join(s, { id: "late", name: "late", streak: 0 }, 5)).toEqual({ ok: false, reason: "in_progress" });
  });
});

describe("turns", () => {
  beforeEach(() => {
    add("a");
    add("b");
    add("c");
    start(s, "a", 1000, deps);
  });

  it("seat 0 goes first and the fuse is set", () => {
    expect(s.turnId).toBe("a");
    expect(s.chunk).toBe("ing");
    expect(s.deadline).toBe(1000 + 10_000);
  });

  it("only the active player can answer, and only with a valid unused word containing the chunk", () => {
    expect(submit(s, "b", "singing", 2000, deps)).toEqual({ ok: false, reason: "not_your_turn" });
    expect(submit(s, "a", "hello", 2000, deps)).toEqual({ ok: false, reason: "missing_chunk" });
    expect(submit(s, "a", "zzing", 2000, deps)).toEqual({ ok: false, reason: "not_a_word" });
    expect(submit(s, "a", "singing", 2000, deps).ok).toBe(true);
    expect(s.turnId).toBe("b");
    expect(submit(s, "b", "singing", 3000, deps)).toEqual({ ok: false, reason: "already_used" });
  });

  it("rejects answers that arrive after the fuse", () => {
    expect(submit(s, "a", "singing", s.deadline, deps)).toEqual({ ok: false, reason: "too_late" });
  });

  it("burns a life when the fuse runs out, and knocks players out at zero", () => {
    expect(tick(s, 5000, deps)).toBe(false);
    for (let i = 0; i < LIVES; i++) {
      // a's turn comes round once every 3 turns; burn b and c quickly by answering
      expect(s.turnId).toBe("a");
      tick(s, s.deadline, deps);
      submit(s, "b", "ring", s.deadline - 1, deps);
      submit(s, "c", "bring", s.deadline - 1, deps);
      s.used = [];
    }
    expect(s.players.find((p) => p.id === "a")!.out).toBe(true);
    expect(s.phase).toBe("playing");
  });

  it("ends with a winner when one player is left", () => {
    s.players.find((p) => p.id === "b")!.lives = 1;
    s.players.find((p) => p.id === "c")!.lives = 1;
    submit(s, "a", "singing", 2000, deps); // b's turn
    tick(s, s.deadline, deps); // b out
    tick(s, s.deadline, deps); // c out
    expect(s.phase).toBe("ended");
    expect(s.winnerId).toBe("a");
    expect(nextWakeup(s)).toBeNull();
  });

  it("shrinks the fuse as the game goes on, down to a floor", () => {
    for (let i = 0; i < 200 && s.phase === "playing"; i++) {
      s.used = [];
      submit(s, s.turnId!, "singing", s.deadline - 1, deps);
    }
    expect(s.turnMs).toBe(5000);
  });
});

describe("powerups", () => {
  it("a streak of 3+ earns one +3s powerup, usable once on your own turn", () => {
    add("a", 0, 5);
    add("b", 0, 0);
    start(s, "a", 0, deps);
    expect(powerup(s, "b", 1)).toEqual({ ok: false, reason: "not_your_turn" });
    const before = s.deadline;
    expect(powerup(s, "a", 1).ok).toBe(true);
    expect(s.deadline).toBe(before + 3000);
    expect(powerup(s, "a", 2)).toEqual({ ok: false, reason: "no_powerup" });
  });

  it("is not granted for a short streak", () => {
    add("a", 0, 2);
    expect(s.players[0].powerups).toBe(0);
  });
});

describe("reconnects", () => {
  beforeEach(() => {
    add("a");
    add("b");
    add("c");
    start(s, "a", 0, deps);
  });

  it("holds a disconnected seat and restores it, lives intact", () => {
    s.players[1].lives = 2;
    disconnect(s, "b", 1000);
    expect(s.players[1].connected).toBe(false);
    expect(join(s, { id: "b", name: "b", streak: 0 }, 5000).ok).toBe(true);
    expect(s.players[1]).toMatchObject({ connected: true, lives: 2 });
  });

  it("eliminates a player who stays gone past the seat hold", () => {
    disconnect(s, "b", 1000);
    expect(reapStale(s, 1000 + SEAT_HOLD_MS - 1, deps)).toBe(false);
    expect(reapStale(s, 1000 + SEAT_HOLD_MS, deps)).toBe(true);
    expect(s.players[1].out).toBe(true);
  });

  it("passes the turn on if the disconnected player was up", () => {
    disconnect(s, "a", 1000);
    reapStale(s, 1000 + SEAT_HOLD_MS, deps);
    expect(s.turnId).toBe("b");
  });

  it("host handoff goes to the longest-connected player", () => {
    disconnect(s, "a", 1000);
    expect(s.hostId).toBe("b");
  });

  it("wakes at the earlier of the fuse and the seat-hold expiry", () => {
    disconnect(s, "b", 1000);
    expect(nextWakeup(s)).toBe(Math.min(s.deadline, 1000 + SEAT_HOLD_MS));
  });
});

describe("rematch", () => {
  it("returns to the lobby with fresh lives, host only", () => {
    add("a");
    add("b");
    start(s, "a", 0, deps);
    s.players[1].out = true;
    s.phase = "ended";
    s.winnerId = "a";
    expect(rematch(s, "b")).toEqual({ ok: false, reason: "not_host" });
    expect(rematch(s, "a").ok).toBe(true);
    expect(s.phase).toBe("lobby");
    expect(s.players.every((p) => p.lives === LIVES && !p.out)).toBe(true);
  });
});
