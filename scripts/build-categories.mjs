// Builds src/lib/categories/data.json from scripts/categories-source.mjs.
// Completion groups are verified: only members that form a real dictionary word survive.
import fs from "node:fs";
import { createRequire } from "node:module";
import { SETS, TRAPS, BLANKS } from "./categories-source.mjs";
const require = createRequire(import.meta.url);
const dict = new Set(require("an-array-of-english-words"));
const wl = require("wordlist-english");
const bad = new Set(require("badwords-list").array.map((w) => w.toLowerCase()));
const HIDDEN = JSON.parse(fs.readFileSync("src/lib/categories/hidden.json", "utf8"));
const toks = (s) => [...new Set(s.split(/\s+/).filter(Boolean))];

const cats = [];
for (const [id, title, family, words] of SETS) {
  const w = toks(words);
  if (w.length < 6) console.log("WARN small set", id, w.length);
  cats.push({ id, title, family, kind: "set", words: w });
}
// A trap list that repeats an existing category tops it up rather than appearing twice.
const MERGE = { "t-tools": "tools", "t-birds": "birds", "t-gems": "gems", "t-code": "languages", "t-danceswing": "dances", "t-countries": "countries", "t-shoes": "footwear" };
for (const [id, title, family, words] of TRAPS) {
  const twin = cats.find((c) => c.id === MERGE[id]);
  if (twin) twin.words = [...new Set([...twin.words, ...toks(words)])];
  else cats.push({ id, title, family, kind: "set", words: toks(words) });
}

// Hidden-word groups: common words with something tucked inside. Real compounds (redhead) give it away, so they are out.
const common = [...wl["english/10"], ...wl["english/20"]].filter((w) => /^[a-z]{5,8}$/.test(w) && !/[^s]s$/.test(w) && !bad.has(w));
for (const [what, targets] of Object.entries(HIDDEN)) {
  const words = common.filter((w) =>
    targets.some((t) => {
      const i = w.indexOf(t);
      if (i < 0) return false;
      const rest = [w.slice(0, i), w.slice(i + t.length)];
      return !rest.some((r) => r.length >= 3 && dict.has(r)) && !dict.has(`${rest[0]}${rest[1]}`);
    }),
  );
  const picked = [...new Set(words)].sort((a, b) => a.length - b.length).slice(0, 60);
  cats.push({ id: `hidden-${what.replace(" ", "")}`, title: `Hidden ${what}${what.endsWith("s") ? "" : "s"}`, family: "hidden", kind: "hidden", words: picked });
  console.log(`hidden ${what}:`, picked.length, picked.slice(0, 14).join(" "));
}

let dropped = 0, droppedCats = [];
for (const [kind, anchor, words] of BLANKS) {
  const all = toks(words);
  const ok = all.filter((m) => dict.has(kind === "post" ? m + anchor : anchor + m));
  dropped += all.length - ok.length;
  if (ok.length < 8) { droppedCats.push(`${kind}:${anchor} (${ok.length})`); continue; }
  const id = `${kind}-${anchor}`;
  cats.push({
    id,
    title: kind === "post" ? `___${anchor.toUpperCase()}` : `${anchor.toUpperCase()}___`,
    family: "wordplay",
    kind: kind === "post" ? "blank-post" : "blank-pre",
    anchor,
    words: ok,
  });
}
fs.writeFileSync("src/lib/categories/data.json", JSON.stringify(cats));
const sets = cats.filter((c) => c.kind === "set"), blanks = cats.length - sets.length;
console.log(`categories: ${cats.length} (${sets.length} sets, ${blanks} completion groups)`);
console.log(`words: ${new Set(cats.flatMap((c) => c.words)).size} distinct; completion members dropped as non-words: ${dropped}`);
if (droppedCats.length) console.log("dropped categories (too few real compounds):", droppedCats.join(", "));
