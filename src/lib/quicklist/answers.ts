/**
 * Checks Quicklist answers against a list for each category. Server-only: importing this from a client
 * component would ship every list to the browser, so the engine takes it as an argument instead.
 *
 * Lists are comma-separated in lists.json, with "/" joining other names for the same thing, so that
 * "Bombay" and "Mumbai" count as one answer. Spelling is forgiven in two ways: `sound` for the many ways
 * of writing Hinglish (paneer, panir), and `allowance` for typing slips. Neither applies to a real
 * English word, or "house" would pass as "horse" and "pearl" as "pear".
 */
import raw from "./lists.json";
import { normalize, type Check } from "./engine";

/** Categories where one word of a name is enough: "Kohli" for Virat Kohli. */
const NAMES = new Set(["A cricketer or sportsperson", "A famous person", "A fictional character"]);

const squash = (a: string) => normalize(a).replace(/ /g, "");

/** How a word sounds rather than how it was spelt: laddoo, ladu and laddu all come out the same. */
const sound = (key: string) =>
  key.replace(/ph/g, "f").replace(/w/g, "v").replace(/z/g, "j").replace(/ee|y/g, "i").replace(/oo|ou/g, "u")
    .replace(/h/g, "").replace(/(.)\1+/g, "$1").replace(/a$/, "");

/** How many typing slips to forgive: none on short words, where one letter makes a different word. */
const allowance = (len: number) => (len < 4 ? 0 : len < 8 ? 1 : 2);

/** Edit distance, counting two swapped neighbouring letters as one slip. */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

type Index = Map<string, string>;
type Lists = Map<string, { names: Index; sounds: Index }>;

function indexOf(category: string, list: string): Index {
  const index: Index = new Map();
  for (const entry of list.split(",")) {
    const names = entry.split("/").map((n) => n.trim());
    const canonical = squash(names[0]);
    for (const name of names) {
      index.set(squash(name), canonical);
      if (NAMES.has(category)) {
        for (const word of normalize(name).split(" ")) if (word.length >= 4 && !index.has(word)) index.set(word, canonical);
      }
    }
  }
  return index;
}

const LISTS: Lists = new Map(
  Object.entries(raw as Record<string, string>).map(([c, list]) => {
    const names = indexOf(c, list);
    const sounds: Index = new Map();
    for (const [name, canonical] of names) if (!sounds.has(sound(name))) sounds.set(sound(name), canonical);
    return [c, { names, sounds }];
  }),
);

/**
 * Builds the check: the listed answer this one means, or null if it isn't on the list. Two players'
 * spellings of one answer come back the same, so they still cancel each other out.
 */
export const checker = (isWord: (w: string) => boolean): Check => (category, answer) => {
  const list = LISTS.get(category);
  const key = squash(answer);
  if (!list || !key) return null;
  const exact = list.names.get(key);
  if (exact) return exact;
  if (isWord(key) || isWord(`${key}s`)) return null;
  const heard = list.sounds.get(sound(key));
  if (heard) return heard;
  let best: string | null = null;
  let bestGap = allowance(key.length) + 1;
  for (const [name, canonical] of list.names) {
    if (name[0] !== key[0] || Math.abs(name.length - key.length) >= bestGap) continue;
    const gap = distance(key, name);
    if (gap < bestGap) {
      best = canonical;
      bestGap = gap;
    }
  }
  return best;
};
