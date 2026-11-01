// HTTP load test. Needs the web server on :3101 (or BASE). Plan targets: guess check p95 <= 250 ms.
const BASE = process.env.BASE || "http://localhost:3101";
const pct = (a, p) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
async function run(label, make, total, conc) {
  const lat = []; let err = 0, i = 0;
  const worker = async () => { while (i < total) { const n = i++; const t = performance.now(); try { const r = await make(n); if (r.status >= 500) err++; await r.arrayBuffer(); } catch { err++; } lat.push(performance.now() - t); } };
  const t0 = performance.now(); await Promise.all(Array.from({ length: conc }, worker)); const secs = (performance.now() - t0) / 1000;
  console.log(label.padEnd(24), `${total} req @ ${conc} conc`.padEnd(20), `p50 ${pct(lat, 50).toFixed(0).padStart(4)} ms  p95 ${pct(lat, 95).toFixed(0).padStart(4)} ms  p99 ${pct(lat, 99).toFixed(0).padStart(4)} ms  ${(total / secs).toFixed(0).padStart(5)} req/s  errors ${err}`);
  return { p95: pct(lat, 95), err };
}
const post = (u, b) => fetch(BASE + u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const words = ["crane", "stone", "about", "plant", "light", "world", "house", "music", "water", "smile"];
let bad = 0;
const guess = await run("letterbox guess check", (n) => post("/api/letterbox/guess", { guess: words[n % 10], clientActionId: "load" + String(n).padStart(8, "0") }), 600, 40);
if (guess.p95 > 250) { console.log("  ^ over the 250 ms budget"); bad++; }
bad += (await run("letterbox word list", () => fetch(BASE + "/api/letterbox/words"), 200, 20)).err;
bad += (await run("bundle puzzle", () => fetch(BASE + "/api/bundle/puzzle"), 300, 30)).err;
bad += (await run("sudoku puzzle", () => fetch(BASE + "/api/sudoku/puzzle"), 300, 30)).err;
bad += (await run("pixel picture", () => fetch(BASE + "/api/pixel/start"), 150, 15)).err;
bad += (await run("home page", () => fetch(BASE + "/"), 300, 30)).err;
bad += (await run("sudoku check", () => post("/api/sudoku/check", { grid: "0".repeat(81) }), 300, 30)).err;

// No rate limiting yet: one client can fire unlimited requests.
const burst = await Promise.all(Array.from({ length: 300 }, (_, n) => post("/api/letterbox/guess", { guess: "crane", clientActionId: "burst" + String(n).padStart(8, "0") })));
const limited = burst.filter((r) => r.status === 429).length;
console.log(`rate limiting: ${limited} of 300 rapid requests from one client were limited`, limited ? "" : "(NONE: no rate limiting is in place)");
console.log(bad ? "\nSOME CHECKS FAILED" : "\nLOAD OK (errors 0, guess p95 within budget)");
process.exit(bad ? 1 : 0);
