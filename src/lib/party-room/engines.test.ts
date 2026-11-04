import { describe, expect, it } from "vitest";
import { join, leave, SEAT_HOLD_MS } from "./core";
import { hintline, giveClue, pass, reveal, seat, start as hStart, tick as hTick, viewFor as hView, type HState } from "../hintline/engine";
import { guess, makeDuel, next, ROUNDS, start as dStart, tick as dTick, viewFor as dView } from "../duel/engine";
import { chat, choose, doodle, draw, GRACE_MS, judgeGuess, rematch, start as sStart, tick as sTick, viewFor as sView, type DoodleState } from "../doodle/engine";
import { PALETTE, REVEAL_MS } from "../doodle/rules";
import { MAX_GUESSES, scoreGuess } from "../letterbox/scoring";

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
  const wrong = (s: ReturnType<typeof ready>) => (s.answer === "crane" ? "stone" : "crane");
  const row = (s: ReturnType<typeof ready>, id: string) => dView(s, id).players.find((x) => x.id === "p")!;
  it("holds a guess back until everyone has guessed, then reveals colours but not letters to rivals", () => {
    const s = ready();
    const w = wrong(s);
    guess(s, "p", w, () => true);
    expect(s.players[0].rows).toHaveLength(0);
    expect(row(s, "q")).toMatchObject({ pending: null, locked: true, rows: [] });
    expect(row(s, "p").pending).toBe(w);
    expect(guess(s, "p", w, () => true)).toEqual({ ok: false, reason: "waiting" });
    guess(s, "q", w, () => true);
    expect(s.players.every((p) => p.rows.length === 1 && !p.pending)).toBe(true);
    const v = dView(s, "q");
    expect(v.answer).toBeNull();
    expect(row(s, "q").rows[0]).toEqual({ guess: null, marks: scoreGuess(w, s.answer) });
    expect(row(s, "p").rows[0].guess).toBe(w);
  });
  it("first to solve takes the round, a shared solve is a shared point, and five rounds never repeat a word", () => {
    const s = ready();
    guess(s, "p", s.answer, () => true);
    guess(s, "q", s.answer, () => true);
    expect(s.winners).toEqual(["p", "q"]);
    next(s, "p", 0, Math.random);
    for (let i = 1; i < ROUNDS; i++) {
      guess(s, "p", wrong(s), () => true);
      guess(s, "q", s.answer, () => true);
      expect(s.phase).toBe("scored");
      expect(s.winners).toEqual(["q"]);
      next(s, "p", 0, Math.random);
    }
    expect(s.phase).toBe("final");
    expect(s.players.map((x) => x.total)).toEqual([1, ROUNDS]);
    expect(new Set(s.used).size).toBe(ROUNDS);
  });
  it("doesn't wait for a player who left or ran out of guesses", () => {
    const s = ready();
    s.players[1].connected = false;
    guess(s, "p", wrong(s), () => true);
    expect(s.players[0].rows).toHaveLength(1);
    s.players[1].connected = true;
    for (let i = 0; i < MAX_GUESSES - 1; i++) {
      guess(s, "q", wrong(s), () => true);
      guess(s, "p", wrong(s), () => true);
    }
    expect(s.players.map((p) => p.rows.length)).toEqual([MAX_GUESSES, MAX_GUESSES - 1]);
    guess(s, "q", wrong(s), () => true);
    expect(s.phase).toBe("scored");
    expect(s.winners).toEqual([]);
  });
  it("refuses non-words, and a round nobody solves ends on time with locked guesses still counted", () => {
    const s = ready();
    expect(guess(s, "p", "zzzzz", () => false)).toEqual({ ok: false, reason: "not_a_word" });
    guess(s, "p", s.answer, () => true);
    dTick(s, s.deadline);
    expect(s.phase).toBe("scored");
    expect(s.winners).toEqual(["p"]);
  });
});

describe("doodle dash", () => {
  const ready = (ids = ["a", "b", "c"]) => {
    const s = seed(doodle, ids, doodle as never);
    expect(sStart(s, "a", 0, r).ok).toBe(true);
    return s;
  };
  const picked = (ids?: string[]) => {
    const s = ready(ids);
    expect(choose(s, s.drawer!, 0, 0, r).ok).toBe(true);
    return s;
  };
  const guessersOf = (s: DoodleState) => s.players.filter((p) => p.id !== s.drawer).map((p) => p.id);
  it("only the drawer sees the word choices and the word; guessers see blanks", () => {
    const s = ready();
    expect(s.phase).toBe("choosing");
    const [g] = guessersOf(s);
    expect(sView(s, s.drawer!).choices).toHaveLength(3);
    expect(sView(s, g).choices).toEqual([]);
    choose(s, s.drawer!, 1, 0, r);
    expect(sView(s, s.drawer!).word).toBe(s.word);
    expect(sView(s, g).word).toBe(s.word.replace(/[a-z]/g, "_"));
  });
  it("judges guesses: exact, inside a sentence, close, wrong", () => {
    expect(judgeGuess("Ice Cream", "ice cream")).toBe("right");
    expect(judgeGuess("icecream", "ice cream")).toBe("right");
    expect(judgeGuess("is it a cat?", "cat")).toBe("right");
    expect(judgeGuess("category", "cat")).toBe("wrong");
    expect(judgeGuess("elefant", "elephant")).toBe("wrong");
    expect(judgeGuess("elephnt", "elephant")).toBe("close");
  });
  it("a right guess scores by speed, is hidden from those still guessing, and the turn ends when all have it", () => {
    const s = picked();
    const [g1, g2] = guessersOf(s);
    chat(s, g1, s.word, 0);
    chat(s, g1, `it was ${s.word}`, 1000);
    expect(s.players.find((p) => p.id === g1)!.gained).toBe(500);
    expect(JSON.stringify(sView(s, g2).chat)).not.toContain(s.word);
    expect(sView(s, s.drawer!).chat.some((m) => m.kind === "inner")).toBe(true);
    expect(sView(s, g1).word).toBe(s.word);
    chat(s, g2, s.word, s.drawMs / 2);
    expect(s.phase).toBe("turnEnd");
    const p = (id: string) => s.players.find((x) => x.id === id)!;
    expect(p(g2).score).toBeLessThan(p(g1).score);
    expect(p(s.drawer!).score).toBe(300);
  });
  it("close guesses are only told to the guesser", () => {
    const s = ready();
    s.choices = ["elephant", "elephant", "elephant"];
    choose(s, s.drawer!, 0, 0, r);
    const [g1, g2] = guessersOf(s);
    chat(s, g1, "elephnt", 0);
    expect(sView(s, g1).chat.some((m) => m.kind === "close")).toBe(true);
    expect(sView(s, g2).chat.some((m) => m.kind === "close")).toBe(false);
  });
  it("gives letter hints as time runs down", () => {
    const s = ready();
    s.choices = ["elephant", "elephant", "elephant"];
    choose(s, s.drawer!, 0, 0, r);
    const g = guessersOf(s)[0];
    sTick(s, s.drawMs * 0.5);
    expect(sView(s, g).word.replace(/_/g, "")).toHaveLength(1);
    sTick(s, s.drawMs * 0.7);
    expect(sView(s, g).word.replace(/_/g, "")).toHaveLength(2);
  });
  it("everyone draws once a round, then the game ends", () => {
    const s = ready();
    s.rounds = 2;
    const drawers: string[] = [];
    let t = 0;
    while (s.phase !== "final") {
      drawers.push(s.drawer!);
      choose(s, s.drawer!, 0, t, r);
      sTick(s, (t += s.drawMs));
      sTick(s, (t += REVEAL_MS));
    }
    expect(drawers).toHaveLength(6);
    expect(new Set(drawers.slice(0, 3)).size).toBe(3);
    expect(drawers.slice(3)).toEqual(drawers.slice(0, 3));
    expect(rematch(s, "a").ok).toBe(true);
    expect(s.phase).toBe("lobby");
  });
  it("only the drawer can draw, and bad drawings are refused", () => {
    const s = picked();
    const [g] = guessersOf(s);
    expect(draw(s, g, [{ c: PALETTE[0], w: 3, p: [1, 2] }]).ok).toBe(false);
    expect(draw(s, s.drawer!, [{ c: PALETTE[0], w: 3, p: [1, 2] }]).ok).toBe(true);
    expect(draw(s, s.drawer!, [{ c: "red", w: 3, p: [1, 2] }]).ok).toBe(false);
    expect(draw(s, s.drawer!, [{ c: PALETTE[0], w: 3, p: Array(10_000).fill(1) }]).ok).toBe(false);
  });
  it("waits a moment for a drawer who reloads, then moves on if they don't come back", () => {
    const s = picked();
    const drawer = s.drawer!;
    leave(s, drawer, 1000);
    sTick(s, 2000);
    expect(s.phase).toBe("drawing");
    sTick(s, 1000 + GRACE_MS);
    expect(s.phase).toBe("turnEnd");
    expect(doodle.nextWakeup(s)).toBe(s.deadline);
  });
});
