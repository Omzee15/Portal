// Builds src/lib/categories/data.json from scripts/categories-source.mjs.
// Completion groups are verified: only members that form a real dictionary word survive.
import fs from "node:fs";
import { createRequire } from "node:module";
import { SETS, BLANKS } from "./categories-source.mjs";
const require = createRequire(import.meta.url);
const dict = new Set(require("an-array-of-english-words"));
const toks = (s) => [...new Set(s.split(/\s+/).filter(Boolean))];

const cats = [];
for (const [id, title, family, words] of SETS) {
  const w = toks(words);
  if (w.length < 6) console.log("WARN small set", id, w.length);
  cats.push({ id, title, family, kind: "set", words: w });
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
