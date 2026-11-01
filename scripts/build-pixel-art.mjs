// Builds assets/pixel/art.json: famous public-domain artworks from Wikidata + Wikimedia Commons.
// Fame = number of Wikipedia languages with an article (a good proxy for "recognisable").
// Public domain = the creator died before 1950 (so the reproduction is free to use).
import fs from "node:fs";

const UA = "PortalApp/0.1 (+https://github.com/nehasultann/Portal)";
// One small query per fame band (a single big sorted query times out on Wikidata's servers).
const BANDS = [[60, 9999], [40, 59], [30, 39], [24, 29], [20, 23], [17, 19], [14, 16]];
const bandQuery = (lo, hi) => `
SELECT ?p ?pLabel ?creatorLabel ?image ?sitelinks WHERE {
  VALUES ?type { wd:Q3305213 wd:Q11060274 }
  ?p wdt:P31 ?type ; wdt:P18 ?image ; wdt:P170 ?creator ; wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${lo} && ?sitelinks <= ${hi})
  ?creator wdt:P570 ?death . FILTER(YEAR(?death) < 1950)
  ?p rdfs:label ?pLabel . FILTER(LANG(?pLabel) = "en")
  ?creator rdfs:label ?creatorLabel . FILTER(LANG(?creatorLabel) = "en")
} LIMIT 3000`;

async function run(lo, hi) {
  const url = "https://query.wikidata.org/sparql?" + new URLSearchParams({ query: bandQuery(lo, hi) });
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/sparql-results+json" }, signal: AbortSignal.timeout(70000) });
      if (res.ok) return (await res.json()).results.bindings;
      console.log(`  band ${lo}-${hi}: HTTP ${res.status}, retrying`);
    } catch (e) {
      console.log(`  band ${lo}-${hi}: ${e.name}, retrying`);
    }
    await new Promise((r) => setTimeout(r, 20000 * (i + 1)));
  }
  return null;
}

// Usage: node scripts/build-pixel-art.mjs [lo ...]  (only those bands, merged into the existing file)
const only = process.argv.slice(2).map(Number);
const rows = [];
for (const [lo, hi] of BANDS.filter(([lo]) => only.length === 0 || only.includes(lo))) {
  const got = await run(lo, hi);
  console.log(`band ${lo}-${hi}:`, got ? got.length : "FAILED (skipped)");
  if (got) rows.push(...got);
  await new Promise((r) => setTimeout(r, 12000)); // be polite to the query service
}
const data = { results: { bindings: rows } };

const prior = only.length && fs.existsSync("assets/pixel/art.json") ? JSON.parse(fs.readFileSync("assets/pixel/art.json", "utf8")) : [];
const seen = new Set(prior.map((a) => a.file));
const out = [...prior];
for (const b of data.results.bindings) {
  const title = b.pLabel.value;
  const artist = b.creatorLabel.value;
  if (/^Q\d+$/.test(title) || /^Q\d+$/.test(artist)) continue; // no English label
  const file = decodeURIComponent(b.image.value.split("Special:FilePath/")[1] ?? "");
  if (!file || !/\.(jpe?g|png)$/i.test(file) || seen.has(file)) continue;
  seen.add(file);
  out.push({ id: b.p.value.split("/").pop(), title, artist, file, sitelinks: Number(b.sitelinks.value) });
}
out.sort((a, b) => b.sitelinks - a.sitelinks);
fs.writeFileSync("assets/pixel/art.json", JSON.stringify(out));
const bands = [[100, 9999], [50, 99], [32, 49], [21, 31], [14, 20]];
console.log("artworks:", out.length);
for (const [lo, hi] of bands) console.log(`  sitelinks ${lo}-${hi}:`, out.filter((a) => a.sitelinks >= lo && a.sitelinks <= hi).length);
console.log("most famous:", out.slice(0, 6).map((a) => `${a.title} (${a.artist})`).join(" | "));
console.log("sample mid:", out.slice(900, 905).map((a) => `${a.title} (${a.artist})`).join(" | "));
console.log("sample low:", out.slice(-5).map((a) => `${a.title} (${a.artist})`).join(" | "));
