import { beforeEach, describe, expect, it } from "vitest";
import {
  CATEGORIES_PER_ROUND, REVIEW_MS, ROUNDS, WRITE_MS, disconnect, done, flag, join, judge, newState, next,
  nextWakeup, normalize, ready, rematch, setAnswer, start, tick, viewFor, winners, type QState,
} from "./engine";

const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };
let s: QState;
const add = (id: string, t = 0) => join(s, { id, name: id }, t);
const begin = () => { add("a"); add("b"); add("c"); start(s, "a", 0, seq(0.1, 0.5, 0.9)); };
const write = (id: string, cat: number, text: string) => setAnswer(s, id, cat, text);

beforeEach(() => { s = newState(); });

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

  it("moves to review early once every connected player is done", () => {
    done(s, "a", 1000); done(s, "b", 1000);
    expect(s.phase).toBe("writing");
    done(s, "c", 1000);
    expect(s.phase).toBe("review");
  });

  it("moves to review when time runs out and locks the answers", () => {
    write("a", 0, "x");
    expect(tick(s, WRITE_MS - 1)).toBe(false);
    expect(tick(s, WRITE_MS)).toBe(true);
    expect(s.phase).toBe("review");
    expect(write("a", 0, "changed")).toEqual({ ok: false, reason: "not_writing" });
  });

  it("does not let a player edit after pressing done", () => {
    done(s, "a", 10);
    expect(write("a", 0, "x")).toEqual({ ok: false, reason: "already_done" });
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

  const toReview = () => { done(s, "a", 1); done(s, "b", 1); done(s, "c", 1); };

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

  it("review ends on the timer or when everyone is ready; then the host moves on", () => {
    done(s, "a", 1); done(s, "b", 1); done(s, "c", 1);
    expect(nextWakeup(s)).toBe(1 + REVIEW_MS);
    expect(tick(s, 1 + REVIEW_MS)).toBe(true);
    expect(s.phase).toBe("results");
    expect(next(s, "b", 5)).toEqual({ ok: false, reason: "not_host" });
    expect(next(s, "a", 5).ok).toBe(true);
    expect(s.round).toBe(2);
    expect(s.phase).toBe("writing");
  });

  it("never repeats a letter or a category across rounds, and ends after the last round", () => {
    const letters = [s.letter];
    const cats = [...s.categories];
    for (let r = 2; r <= ROUNDS; r++) {
      tick(s, s.deadline); tick(s, s.deadline); // writing -> review -> results
      expect(s.phase).toBe("results");
      next(s, "a", 0);
      letters.push(s.letter);
      cats.push(...s.categories);
    }
    expect(new Set(letters).size).toBe(ROUNDS);
    expect(new Set(cats).size).toBe(ROUNDS * CATEGORIES_PER_ROUND);
    tick(s, s.deadline); tick(s, s.deadline);
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
