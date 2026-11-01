// Checks that every artwork image still downloads, and records the dead ones in assets/pixel/art-dead.json
// (the game skips them). Polite: one request per second. Run it again before a release.
import fs from "node:fs";
const UA = "PortalApp/0.1 (+https://github.com/nehasultann/Portal)";
const art = JSON.parse(fs.readFileSync("assets/pixel/art.json", "utf8"));
const dead = [];
let i = 0;
for (const a of art) {
  i++;
  let ok = false;
  for (let t = 0; t < 3 && !ok; t++) {
    try {
      const r = await fetch(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(a.file)}?width=300`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      const ct = r.headers.get("content-type") ?? "";
      ok = r.ok && ct.startsWith("image/") && (await r.arrayBuffer()).byteLength > 3000;
      if (!ok && r.status === 404) break; // a real 404 won't come back
    } catch { /* retry */ }
    if (!ok) await new Promise((res) => setTimeout(res, 1500 * (t + 1)));
  }
  if (!ok) { dead.push(a.file); console.log("dead:", a.title); }
  if (i % 50 === 0) console.log(`  checked ${i}/${art.length}, dead so far ${dead.length}`);
  await new Promise((res) => setTimeout(res, 1000));
}
fs.writeFileSync("assets/pixel/art-dead.json", JSON.stringify(dead, null, 1));
console.log(`done: ${art.length - dead.length}/${art.length} images are alive, ${dead.length} dead`);
