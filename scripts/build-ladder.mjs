// Builds the Word Ladder pools. Words are everyday 4-letter words; for every pair we know the exact
// shortest path length. Medium = 5 steps, hard = 6, expert = 7 or more.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const wl = require("wordlist-english");
const dict = new Set(require("an-array-of-english-words"));
const bad = new Set(require("badwords-list").array.map((w) => w.toLowerCase()));

const words = [...new Set(["english/10", "english/20", "english/35"].flatMap((b) => wl[b]))]
  .filter((w) => /^[a-z]{4}$/.test(w) && dict.has(w) && !bad.has(w))
  .sort();
const idx = new Map(words.map((w, i) => [w, i]));
// Puzzle endpoints must be instantly recognisable: top-frequency words, no plurals. Paths may use any common word.
const top = new Set([...wl["english/10"], ...wl["english/20"]]);
const endpoint = (w) => top.has(w) && !/[^s]s$/.test(w) && !/(ed|er|ly)$/.test(w);
const adj = words.map((w) => {
  const out = [];
  for (let i = 0; i < 4; i++)
    for (let c = 97; c < 123; c++) {
      const n = w.slice(0, i) + String.fromCharCode(c) + w.slice(i + 1);
      if (n !== w && idx.has(n)) out.push(idx.get(n));
    }
  return out;
});

const pools = { medium: [], hard: [], expert: [] };
for (let s = 0; s < words.length; s++) {
  const dist = new Int16Array(words.length).fill(-1);
  dist[s] = 0;
  let q = [s];
  while (q.length) {
    const nq = [];
    for (const u of q) for (const v of adj[u]) if (dist[v] < 0) { dist[v] = dist[u] + 1; nq.push(v); }
    q = nq;
  }
  if (!endpoint(words[s])) continue;
  for (let t = s + 1; t < words.length; t++) {
    if (!endpoint(words[t])) continue;
    const d = dist[t];
    if (d === 5) pools.medium.push([words[s], words[t]]);
    else if (d === 6) pools.hard.push([words[s], words[t]]);
    else if (d >= 7) pools.expert.push([words[s], words[t], d]);
  }
}
const sizes = Object.fromEntries(Object.entries(pools).map(([k, v]) => [k, v.length]));
console.log("common words:", words.length, "| pairs found:", sizes);

// keep a manageable, deterministic sample of each (stored as "a b" or "a b d")
let seed = 12345;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const sample = (arr, n) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
const out = {
  medium: sample(pools.medium, 3000).map((p) => p.join(" ")),
  hard: sample(pools.hard, 3000).map((p) => p.join(" ")),
  expert: sample(pools.expert, 3000).map((p) => p.join(" ")),
};
fs.writeFileSync("src/lib/ladder/ladders.json", JSON.stringify(out));
fs.writeFileSync("src/lib/ladder/common4.json", JSON.stringify(words));
console.log("saved:", Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
console.log("examples:", out.medium.slice(0, 3), out.hard.slice(0, 3), out.expert.slice(0, 3));
