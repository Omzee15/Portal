import { describe, expect, it } from "vitest";
import { join, leave, SEAT_HOLD_MS } from "./core";
import { hintline, giveClue, pass, reveal, seat, start as hStart, tick as hTick, viewFor as hView, type HState } from "../hintline/engine";
import { guess, makeDuel, next, ROUNDS, start as dStart, tick as dTick, viewFor as dView } from "../duel/engine";
import { doodle, rematch, start as sStart, submit, tick as sTick, viewFor as sView, DRAW_MS } from "../doodle/engine";
import { scoreGuess } from "../letterbox/scoring";

const seed = <S extends { players: { id: string }[] }>(e: { newState(): S }, ids: string[], engine: Parameters<typeof join>[0]) => {
  const s = e.newState();
  for (const id of ids) join(engine, s as never, { id, name: id }, 0);
  return s;
};
const r = () => 0.3;

describe("hintline", () => {
  const ready = () => {
    const s = seed(hintline, ["a1", "a2", "b1", "b2"], hintline as never) as HState;
    seat(s, "a1", "a", "clue"); seat(s, "a2", "a", "guess"); seat(s, "b1", "b", "clue"); seat(s, "b2", "b", "guess");
    expect(hStart(s, "a1", 0, r).ok).toBe(true);
    return s;
  };
  const cl = (s: HState) => (s.turn === "a" ? ["a1", "a2"] : ["b1", "b2"]);

  it("deals 9/8/7/1 and hides the key from guessers only", () => {
    const s = ready();
    const n = (c: string) => s.board.filter((x) => x.card === c).length;
    expect([n(s.turn), n(s.turn === "a" ? "b" : "a"), n("plain"), n("trap")]).toEqual([9, 8, 7, 1]);
    expect(hView(s, "a2").board.every((c) => c.card === null)).toBe(true);
    expect(hView(s, "a1").board.every((c) => c.card !== null)).toBe(true);
  });
  it("needs four players", () => {
    const s = seed(hintline, ["x", "y", "z"], hintline as never) as HState;
    expect(hStart(s, "x", 0, r)).toEqual({ ok: false, reason: "need_more_players" });
  });
  it("refuses a clue that is on the board, and non-clue-givers", () => {
    const s = ready();
    const [c, g] = cl(s);
    expect(giveClue(s, c, s.board[0].word, 1, 0)).toEqual({ ok: false, reason: "clue_on_board" });
    expect(giveClue(s, c, "two words", 1, 0)).toEqual({ ok: false, reason: "one_word_only" });
    expect(giveClue(s, g, "zzzz", 1, 0).ok).toBe(false);
  });
  it("gets count+1 guesses, wrong colour ends the turn, the trap loses at once", () => {
    const s = ready();
    let [c, g] = cl(s);
    const team = s.turn;
    giveClue(s, c, "zzzz", 1, 0);
    expect(s.guessesLeft).toBe(2);
    reveal(s, g, s.board.findIndex((x) => x.card === team && !x.up), 0);
    expect(s.turn).toBe(team);
    reveal(s, g, s.board.findIndex((x) => x.card === "plain"), 0);
    expect(s.turn).not.toBe(team);
    [c, g] = cl(s);
    giveClue(s, c, "qqqq", 2, 0);
    reveal(s, g, s.board.findIndex((x) => x.card === "trap"), 0);
    expect(s.phase).toBe("ended");
    expect(s.winner).toBe(team);
  });
  it("clearing your cards wins, and passing swaps turns", () => {
    const s = ready();
    const [c, g] = cl(s);
    const team = s.turn;
    giveClue(s, c, "zzzz", 9, 0);
    pass(s, g, 0);
    expect(s.turn).not.toBe(team);
    const [c2, g2] = cl(s);
    giveClue(s, c2, "qqqq", 9, 0);
    for (const i of s.board.flatMap((x, n) => (x.card === s.turn ? [n] : []))) reveal(s, g2, i, 0);
    expect(s.phase).toBe("ended");
  });
  it("a turn times out, and a clue-giver who left is replaced", () => {
    const s = ready();
    const [c] = cl(s);
    const team = s.turn;
    const mate = s.players.find((p) => p.team === team && p.id !== c)!;
    leave(s, c, 1000);
    hTick(s, 1000 + SEAT_HOLD_MS);
    expect(mate.role).toBe("clue");
    hTick(s, 10_000_000);
    expect(s.turn).not.toBe(team);
  });
});

describe("letterbox duel", () => {
  const engine = makeDuel(() => true);
  const ready = () => {
    const s = seed(engine, ["p", "q"], engine as never);
    expect(dStart(s, "p", 0, r).ok).toBe(true);
    return s;
  };
  it("rivals see colours, not letters or the word", () => {
    const s = ready();
    guess(s, "p", "crane", () => true);
    const v = dView(s, "q");
    expect(v.answer).toBeNull();
    expect(v.players.find((x) => x.id === "p")!.rows[0].guess).toBeNull();
    expect(v.players.find((x) => x.id === "p")!.rows[0].marks).toEqual(scoreGuess("crane", s.answer));
    expect(dView(s, "p").players.find((x) => x.id === "p")!.rows[0].guess).toBe("crane");
  });
  it("first to solve takes the round, and five rounds never repeat a word", () => {
    const s = ready();
    for (let i = 0; i < ROUNDS; i++) {
      guess(s, "q", s.answer, () => true);
      expect(s.phase).toBe("scored");
      next(s, "p", 0, Math.random);
    }
    expect(s.phase).toBe("final");
    expect(s.players.find((x) => x.id === "q")!.total).toBe(ROUNDS);
    expect(new Set(s.used).size).toBe(ROUNDS);
  });
  it("refuses non-words, and a round nobody solves ends on time", () => {
    const s = ready();
    expect(guess(s, "p", "zzzzz", () => false)).toEqual({ ok: false, reason: "not_a_word" });
    dTick(s, s.deadline);
    expect(s.phase).toBe("scored");
    expect(s.roundWinner).toBeNull();
  });
});

describe("doodle relay", () => {
  const ready = (ids = ["a", "b", "c", "d"]) => {
    const s = seed(doodle, ids, doodle as never);
    expect(sStart(s, "a", 0, r).ok).toBe(true);
    return s;
  };
  const stroke = [{ c: "#2e2a26", w: 3, p: [1, 2, 3, 4] }];
  const playStep = (s: ReturnType<typeof ready>) => {
    for (const p of [...s.players]) {
      const v = sView(s, p.id);
      submit(s, p.id, v.task === "draw" ? { strokes: stroke, final: true } : { text: `${p.id}:${s.step}`, final: true }, 0);
    }
  };
  it("passes each chain round so a page is always somebody else's, then reveals everything", () => {
    const s = ready();
    expect(sView(s, "a").task).toBe("write");
    playStep(s);
    expect(sView(s, "a").task).toBe("draw");
    expect(sView(s, "a").incoming?.text).toBeTruthy();
    expect(sView(s, "a").incoming?.by).not.toBe("a");
    playStep(s);
    expect(sView(s, "a").task).toBe("guess");
    expect(sView(s, "a").incoming?.strokes).toBeTruthy();
    playStep(s); playStep(s);
    expect(s.phase).toBe("reveal");
    const v = sView(s, "a");
    expect(v.chains).toHaveLength(4);
    for (const c of v.chains!) {
      expect(c).toHaveLength(4);
      expect(new Set(c.map((p) => p.by)).size).toBe(4);
    }
    expect(rematch(s, "a").ok).toBe(true);
    expect(s.phase).toBe("lobby");
  });
  it("uses drafts when time runs out and fills blanks", () => {
    const s = ready(["a", "b", "c"]);
    playStep(s);
    submit(s, "a", { strokes: stroke }, 0);
    sTick(s, DRAW_MS + 1);
    expect(s.step).toBe(2);
    expect(s.chains.flat().some((p) => p.by === "a" && p.strokes?.length)).toBe(true);
  });
  it("a player who leaves can't hold everyone up", () => {
    const s = ready(["a", "b", "c"]);
    leave(s, "c", 0);
    submit(s, "a", { text: "x", final: true }, 0);
    submit(s, "b", { text: "y", final: true }, 0);
    expect(s.step).toBe(1);
  });
  it("rejects a drawing that is too big or malformed", () => {
    const s = ready(["a", "b", "c"]);
    playStep(s);
    expect(submit(s, "a", { strokes: [{ c: "red", w: 3, p: [1, 2] }] }, 0).ok).toBe(false);
    expect(submit(s, "a", { strokes: [{ c: "#2e2a26", w: 3, p: Array(6000).fill(1) }] }, 0).ok).toBe(false);
  });
});
