// Builds src/lib/splice/pool.json for Wordsplice: common nouns with a clean WordNet definition as the clue.
// Tier comes from word frequency (common = medium, rarer = hard, rare = expert).
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const wl = require("wordlist-english");
const dict = new Set(require("an-array-of-english-words"));
const bad = new Set(require("badwords-list").array.map((w) => w.toLowerCase()));
const DIR = "node_modules/wordnet-db/dict/";

const tierOf = new Map();
for (const [bands, tier] of [[["english/10", "english/20"], "medium"], [["english/35"], "hard"], [["english/40", "english/50"], "expert"]])
  for (const b of bands) for (const w of wl[b]) if (!tierOf.has(w)) tierOf.set(w, tier);

const data = fs.readFileSync(DIR + "data.noun");
const glossAt = (offset) => {
  const end = data.indexOf(10, offset);
  const line = data.toString("latin1", offset, end);
  const i = line.indexOf("|");
  return i < 0 ? "" : line.slice(i + 1).trim();
};

const clean = (gloss, word) => {
  const g = gloss.split(";")[0].replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim().replace(/[.,:]+$/, "");
  if (g.length < 14 || g.length > 78) return null;
  const stem = word.slice(0, Math.max(4, word.length - 3));
  if (g.toLowerCase().includes(stem)) return null; // never give the answer away
  if (/\b(plural|abbreviation|symbol|Latin|genus|family)\b/i.test(g)) return null;
  if (/[^\x20-\x7e]/.test(g)) return null;
  return g[0].toUpperCase() + g.slice(1);
};

const out = [];
for (const line of fs.readFileSync(DIR + "index.noun", "latin1").split("\n")) {
  if (!line || line[0] === " ") continue;
  const f = line.split(" ");
  const word = f[0];
  if (!/^[a-z]{6,11}$/.test(word) || !tierOf.has(word) || !dict.has(word) || bad.has(word)) continue;
  if (/[^s]s$/.test(word)) continue; // plurals
  const pCnt = Number(f[3]);
  const offset = Number(f[6 + pCnt]); // first (most frequent) sense
  const clue = clean(glossAt(offset), word);
  if (clue) out.push({ w: word, c: clue, t: tierOf.get(word) });
}
fs.writeFileSync("src/lib/splice/pool.json", JSON.stringify(out));
const by = (t) => out.filter((x) => x.t === t);
console.log("words:", out.length, { medium: by("medium").length, hard: by("hard").length, expert: by("expert").length });
for (const t of ["medium", "hard", "expert"]) for (const x of by(t).slice(40, 44)) console.log(`${t.padEnd(7)} ${x.w.padEnd(12)} ${x.c}`);
