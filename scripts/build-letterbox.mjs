// Builds src/lib/letterbox/answers.json: answer pools by difficulty.
// Commonness decides the tier (wordlist-english frequency bands). Everything is intersected with a
// real dictionary (no proper nouns) and run through a profanity filter.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const wl = require("wordlist-english");
const dict = new Set(require("an-array-of-english-words"));
const bad = new Set(require("badwords-list").array.map((w) => w.toLowerCase()));

const ok = (w) =>
  /^[a-z]{5}$/.test(w) &&
  dict.has(w) &&
  !bad.has(w) &&
  !/[^s]s$/.test(w) && // skip plurals (a word ending in a single s)
  !/(ing|ed)$/.test(w.slice(1)) === true; // (keeps 5-letter words that merely end in "ed"/"ing" out of the pool: dull answers)

const pool = (bands) => [...new Set(bands.flatMap((b) => wl[b]))].filter(ok).sort();
const medium = pool(["english/10", "english/20"]);
const used = new Set(medium);
const hard = pool(["english/35"]).filter((w) => !used.has(w));
hard.forEach((w) => used.add(w));
const expert = pool(["english/40", "english/50"]).filter((w) => !used.has(w));

fs.writeFileSync("src/lib/letterbox/answers.json", JSON.stringify({ medium, hard, expert }));
console.log({ medium: medium.length, hard: hard.length, expert: expert.length, total: medium.length + hard.length + expert.length });
console.log("sample medium:", medium.slice(300, 312).join(" "));
console.log("sample hard:  ", hard.slice(700, 712).join(" "));
console.log("sample expert:", expert.slice(200, 212).join(" "));
