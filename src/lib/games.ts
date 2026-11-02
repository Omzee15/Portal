/** One registry for every game, so Today, the journal and stats never drift apart. */
export type GameId =
  | "letterbox"
  | "bundle"
  | "pixel-peek"
  | "odd-one"
  | "word-ladder"
  | "emoji-decode"
  | "sudoku"
  | "wordsplice"
  | "fuse"
  | "quicklist";

export type Daily = {
  id: Exclude<GameId, "fuse" | "quicklist">;
  name: string;
  blurb: string;
  /** Tailwind background class for the game's colour */
  bg: string;
  /** The three core dailies make a "full" day; the rest are bonus dailies that still extend your streak. */
  core: boolean;
  /** short text for the stamp on Today and the journal */
  stamp: (score: number, solved: boolean) => string;
  /** the line the journal writes about it */
  line: (score: number, solved: boolean) => string;
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export const DAILIES: Daily[] = [
  {
    id: "letterbox", name: "Letterbox", blurb: "Guess the 5-letter word in 6", bg: "bg-terracotta", core: true,
    stamp: (n, ok) => (ok ? `${n}/6` : "X/6"),
    line: (n, ok) => (ok ? `Solved Letterbox in ${n}.` : "Letterbox got away from you today."),
  },
  {
    id: "bundle", name: "Bundle", blurb: "Sort 16 words into 4 groups", bg: "bg-mustard", core: true,
    stamp: (n, ok) => (ok ? (n === 0 ? "PERFECT" : plural(n, "SLIP")) : "MISSED"),
    line: (n, ok) => (!ok ? "Bundle won this round." : n === 0 ? "A perfect Bundle, no mistakes." : `Bundle with ${n === 1 ? "a single slip" : `${n} slips`}.`),
  },
  {
    id: "pixel-peek", name: "Pixel Peek", blurb: "Name the picture as it sharpens", bg: "bg-sage", core: true,
    stamp: (n, ok) => (ok ? `${n}/5` : "X/5"),
    line: (n, ok) => (ok ? `Pixel Peek cracked in ${n}.` : "Pixel Peek stayed blurry."),
  },
  {
    id: "odd-one", name: "Odd One", blurb: "3 tricky rounds, 90 seconds", bg: "bg-teal", core: false,
    stamp: (n) => `${n}/3`,
    line: (n, ok) => (ok ? "Odd One: a clean sweep." : `Odd One: ${n} of 3.`),
  },
  {
    id: "word-ladder", name: "Word Ladder", blurb: "Change one letter at a time", bg: "bg-mauve-wash", core: false,
    stamp: (n, ok) => (ok ? plural(n, "STEP") : "GAVE UP"),
    line: (n, ok) => (ok ? `Word Ladder climbed in ${plural(n, "step")}.` : "Word Ladder beat you today."),
  },
  {
    id: "emoji-decode", name: "Emoji Decode", blurb: "People, places, films and more in emoji", bg: "bg-mustard", core: false,
    stamp: (n, ok) => (ok ? `${n}/4` : "X/4"),
    line: (n, ok) => (ok ? `Emoji Decode cracked in ${n}.` : "Emoji Decode stumped you."),
  },
  {
    id: "sudoku", name: "Sudoku", blurb: "Fill the grid, no repeats", bg: "bg-teal", core: false,
    stamp: (n, ok) => (ok ? mmss(n) : "OPEN"),
    line: (n, ok) => (ok ? `Sudoku finished in ${mmss(n)}.` : "A Sudoku left half-done."),
  },
  {
    id: "wordsplice", name: "Wordsplice", blurb: "Join the pieces to answer 7 clues", bg: "bg-sage", core: false,
    stamp: (n, ok) => (ok ? (n === 0 ? "CLEAN" : plural(n, "OOPS").replace("OOPSS", "OOPS")) : "OPEN"),
    line: (n, ok) => (ok ? `Wordsplice done${n === 0 ? " without a slip" : ` with ${plural(n, "wrong try").replace("wrong trys", "wrong tries")}`}.` : "Wordsplice still has pieces left."),
  },
];

export const DAILY_BY_ID = Object.fromEntries(DAILIES.map((d) => [d.id, d])) as Record<Daily["id"], Daily>;
export const CORE_IDS = DAILIES.filter((d) => d.core).map((d) => d.id);
