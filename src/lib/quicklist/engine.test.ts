import { beforeEach, describe, expect, it } from "vitest";
import {
  CATEGORIES, CATEGORIES_PER_ROUND, FAMILIES, MIN_WRITE_MS, ROUNDS, WRITE_MS, configure, disconnect, done as finish, flag, join, judge, newState, next,
  nextWakeup, normalize, ready, rematch, reveal, setAnswer, start, startsWith, tick as settle, viewFor, winners, type QState,
} from "./engine";

const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };
let s: QState;
// Unless a test says otherwise, every answer counts as listed, so the scoring tests stay about scoring.
let check = (_c: string, a: string) => (a ? normalize(a) : null);
// Unless a test says otherwise, players press done once it is allowed.
const done = (st: QState, id: string, now = st.startedAt + MIN_WRITE_MS) => finish(st, id, now, check);
const tick = (st: QState, now: number) => settle(st, now, check);
const add = (id: string, t = 0) => join(s, { id, name: id }, t);
const begin = () => { add("a"); add("b"); add("c"); start(s, "a", 0, seq(0.1, 0.5, 0.9)); };
const write = (id: string, cat: number, text: string) => setAnswer(s, id, cat, text);

beforeEach(() => { s = newState(); check = (_c, a) => (a ? normalize(a) : null); });

describe("answers the game doesn't recognise", () => {
  beforeEach(() => {
    check = () => null;
    begin();
    write("a", 0, `${s.letter}zzz`);
    done(s, "a"); done(s, "b"); done(s, "c");
  });

  it("score nothing on their own", () => {
    expect(judge(s, 0).a).toBe("unconfirmed");
    ready(s, "a"); ready(s, "b"); ready(s, "c");
    expect(s.roundPoints.a[0]).toBe(0);
  });

  it("may start with the letter after 'The'", () => {
    expect(startsWith("The Office", "O")).toBe(true);
    expect(startsWith("The Office", "T")).toBe(true);
    expect(startsWith("The Office", "F")).toBe(false);
  });

  it("score once half of the others accept them, and can be un-accepted", () => {
    flag(s, "b", "a", 0);
    expect(judge(s, 0).a).toBe("unique");
    flag(s, "b", "a", 0);
    expect(judge(s, 0).a).toBe("unconfirmed");
  });
});

describe("settings", () => {
  it("the host picks rounds and timer from the allowed choices, before the game only", () => {
    add("a"); add("b");
    expect(configure(s, "b", { rounds: 5 })).toEqual({ ok: false, reason: "not_host" });
    expect(configure(s, "a", { rounds: 9 })).toEqual({ ok: false, reason: "bad_settings" });
    expect(configure(s, "a", { rounds: 4, writeMs: 120_000 }).ok).toBe(true);
    start(s, "a", 0);
    expect(s.deadline).toBe(120_000);
    expect(configure(s, "a", { rounds: 3 })).toEqual({ ok: false, reason: "already_started" });
    for (let r = 0; r < 4; r++) { done(s, "a"); reveal(s, "a"); next(s, "a", 1); }
    expect(s.phase).toBe("final");
    expect(s.history).toHaveLength(4);
  });

  it("keeps every round's answers and verdicts for the results", () => {
    add("a"); add("b"); start(s, "a", 0);
    setAnswer(s, "a", 0, `${s.letter}one`);
    done(s, "a"); reveal(s, "a");
    expect(s.history[0]).toMatchObject({ letter: s.letter, categories: s.categories });
    expect(s.history[0].answers.a[0]).toBe(`${s.letter}one`);
    expect(s.history[0].verdicts.a[0]).toBe("unique");
    expect(s.history[0].verdicts.b[0]).toBe("empty");
  });
});

describe("lobby", () => {
  it("first player is host and needs a second to start; only the host starts", () => {
    add("a");
    expect(start(s, "a", 0)).toEqual({ ok: false, reason: "need_more_players" });
    add("b");
    expect(start(s, "b", 0)).toEqual({ ok: false, reason: "not_host" });
    expect(start(s, "a", 0).ok).toBe(true);
    expect(s.phase).toBe("writing");
    expect(s.categories).toHaveLength(CATEGORIES_PER_ROUND);
  });

  it("refuses newcomers mid-game but lets a dropped player back in", () => {
    begin();
    expect(join(s, { id: "late", name: "late" }, 5)).toEqual({ ok: false, reason: "in_progress" });
    disconnect(s, "b", 10);
    expect(join(s, { id: "b", name: "b" }, 20).ok).toBe(true);
    expect(s.players.find((p) => p.id === "b")!.connected).toBe(true);
  });
});

describe("writing", () => {
  beforeEach(begin);

  it("nobody can end the round in its first half minute", () => {
    expect(done(s, "a", MIN_WRITE_MS - 1)).toEqual({ ok: false, reason: "too_soon" });
    expect(s.phase).toBe("writing");
    expect(done(s, "a", MIN_WRITE_MS).ok).toBe(true);
  });

  it("the first player to press done ends the round for everyone, keeping what they wrote", () => {
    write("b", 0, "half finished");
    done(s, "a");
    expect(s.phase).toBe("review");
    expect(s.answers.b[0]).toBe("half finished");
    expect(write("c", 0, "too late")).toEqual({ ok: false, reason: "not_writing" });
  });

  it("moves to review when time runs out and locks the answers", () => {
    write("a", 0, "x");
    expect(tick(s, WRITE_MS - 1)).toBe(false);
    expect(tick(s, WRITE_MS)).toBe(true);
    expect(s.phase).toBe("review");
    expect(write("a", 0, "changed")).toEqual({ ok: false, reason: "not_writing" });
  });

  it("never shows other players' answers while writing", () => {
    write("a", 0, "secret");
    write("b", 0, "mine");
    const v = viewFor(s, "b");
    expect(Object.keys(v.answers)).toEqual(["b"]);
    expect(JSON.stringify(v)).not.toContain("secret");
  });
});

describe("scoring", () => {
  beforeEach(() => { begin(); });
  const L = () => s.letter;

  const toReview = () => { done(s, "a"); done(s, "b"); done(s, "c"); };

  it("unique valid answers score; duplicates, empties and wrong letters do not", () => {
    write("a", 0, `${L()}one`); write("b", 0, `${L()}two`); write("c", 0, `${L()}two`);
    write("a", 1, `${L()}same`); write("b", 1, `${L()}same`); write("c", 1, `${L()}same`);
    write("a", 2, "zzz"); // wrong letter (letter is never Z)
    toReview();
    const v0 = judge(s, 0);
    expect(v0).toEqual({ a: "unique", b: "duplicate", c: "duplicate" });
    expect(Object.values(judge(s, 1))).toEqual(["duplicate", "duplicate", "duplicate"]);
    expect(judge(s, 2).a).toBe("wrong-letter");
    expect(judge(s, 3).a).toBe("empty");
    s.players.forEach((p) => ready(s, p.id));
    expect(s.phase).toBe("results");
    expect(s.players.find((p) => p.id === "a")!.total).toBe(1);
    expect(s.players.find((p) => p.id === "b")!.total).toBe(0);
  });

  it("treats case, spacing, 'the' and a trailing s as the same answer", () => {
    expect(normalize("  The  Tigers ")).toBe(normalize("tiger"));
    write("a", 0, `${L()}ox cart`); write("b", 0, `${L().toLowerCase()}OX   CART`);
    toReview();
    expect(judge(s, 0).a).toBe("duplicate");
  });

  it("a majority of the other players can vote an answer out", () => {
    write("a", 0, `${L()}weird`);
    toReview();
    flag(s, "b", "a", 0);
    expect(judge(s, 0).a).toBe("unique"); // 1 of 2 others is not a majority
    flag(s, "c", "a", 0);
    expect(judge(s, 0).a).toBe("rejected");
    flag(s, "c", "a", 0); // toggle off
    expect(judge(s, 0).a).toBe("unique");
  });

  it("cannot flag your own answer", () => {
    toReview();
    expect(flag(s, "a", "a", 0)).toEqual({ ok: false, reason: "cannot_flag_own" });
  });

  it("a voted-out answer also stops cancelling out the duplicate it matched", () => {
    write("a", 0, `${L()}dup`); write("b", 0, `${L()}dup`);
    toReview();
    flag(s, "b", "a", 0); flag(s, "c", "a", 0); // a is rejected
    expect(judge(s, 0)).toMatchObject({ a: "rejected", b: "unique" });
  });

  it("flags from a disconnected player do not count", () => {
    write("a", 0, `${L()}odd`);
    toReview();
    flag(s, "b", "a", 0); flag(s, "c", "a", 0);
    disconnect(s, "c", 5);
    // others = just b now (1); votes from connected = 1 -> still a majority of 1
    expect(judge(s, 0).a).toBe("rejected");
  });
});

describe("rounds", () => {
  beforeEach(begin);

  it("review has no clock: it waits for everyone to be ready; then the host moves on", () => {
    done(s, "a");
    expect(nextWakeup(s)).toBeNull();
    expect(tick(s, 10_000_000)).toBe(false);
    expect(s.phase).toBe("review");
    ready(s, "a"); ready(s, "b");
    expect(s.phase).toBe("review");
    ready(s, "c");
    expect(s.phase).toBe("results");
    expect(next(s, "b", 5)).toEqual({ ok: false, reason: "not_host" });
    expect(next(s, "a", 5).ok).toBe(true);
    expect(s.round).toBe(2);
    expect(s.phase).toBe("writing");
  });

  it("only the host can skip waiting for someone who wandered off", () => {
    done(s, "a");
    expect(reveal(s, "b")).toEqual({ ok: false, reason: "not_host" });
    expect(reveal(s, "a").ok).toBe(true);
    expect(s.phase).toBe("results");
  });

  it("doesn't bring questions back in a rematch, and keeps alike ones out of the same round", () => {
    const seen: string[] = [];
    for (let game = 0; game < 2; game++) {
      for (let r = 0; r < ROUNDS; r++) {
        seen.push(...s.categories);
        for (const f of FAMILIES) expect(s.categories.filter((c) => f.includes(c)).length, f[0]).toBeLessThanOrEqual(1);
        done(s, "a"); reveal(s, "a"); next(s, "a", 5);
      }
      expect(s.phase).toBe("final");
      rematch(s, "a");
      start(s, "a", 0);
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBeLessThanOrEqual(CATEGORIES.length);
  });

  it("never repeats a letter or a category across rounds, and ends after the last round", () => {
    const letters = [s.letter];
    const cats = [...s.categories];
    for (let r = 2; r <= ROUNDS; r++) {
      tick(s, s.deadline); reveal(s, s.hostId!); // writing -> review -> results
      expect(s.phase).toBe("results");
      next(s, "a", 0);
      letters.push(s.letter);
      cats.push(...s.categories);
    }
    expect(new Set(letters).size).toBe(ROUNDS);
    expect(new Set(cats).size).toBe(ROUNDS * CATEGORIES_PER_ROUND);
    tick(s, s.deadline); reveal(s, s.hostId!);
    next(s, "a", 0);
    expect(s.phase).toBe("final");
  });

  it("declares the top scorer(s) and resets for a rematch", () => {
    s.players[0].total = 5; s.players[1].total = 5; s.players[2].total = 2;
    expect(winners(s)).toEqual(["a", "b"]);
    s.phase = "final";
    expect(rematch(s, "b")).toEqual({ ok: false, reason: "not_host" });
    expect(rematch(s, "a").ok).toBe(true);
    expect(s.phase).toBe("lobby");
    expect(s.players.every((p) => p.total === 0)).toBe(true);
  });
});
