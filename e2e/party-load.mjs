// Party-server load: many rooms of bots, a reconnect storm, and Quicklist rounds. Needs `npm run party` on :1999.
// Plan targets: message latency p95 <= 150 ms; reconnect storms survive. (Plan: 200 rooms x 8; default here is smaller.)
const FUSE_ROOMS = Number(process.env.FUSE_ROOMS || 100), QL_ROOMS = Number(process.env.QL_ROOMS || 40), BOTS = 8;
const HOST = "127.0.0.1:1999";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
let fail = 0;
const check = (n, c, x = "") => { console.log(c ? "PASS" : "FAIL", n, x); if (!c) fail++; };

class Bot {
  constructor(party, room, pid) { this.party = party; this.room = room; this.pid = pid; this.state = null; this.waiters = []; this.errors = 0; this.closed = null; this.rejected = []; this.counts = []; }
  open() {
    return new Promise((resolve) => {
      this.ws = new WebSocket(`ws://${HOST}/parties/${this.party}/${this.room}?pid=${this.pid}&name=${this.pid}`);
      this.ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === "rejected") this.rejected.push(m.reason); if (m.type === "state") { this.state = m.state; this.counts.push(m.state.players.length); this.waiters = this.waiters.filter((w) => !(w.pred(m.state) && (w.res(performance.now()), true))); } };
      this.ws.onclose = (e) => { this.closed = e.code; };
      this.ws.onerror = () => { this.errors++; resolve(false); };
      this.ws.onopen = () => resolve(true);
    });
  }
  until(pred, ms = 8000) { return new Promise((res) => { if (this.state && pred(this.state)) return res(performance.now()); const t = setTimeout(() => res(null), ms); this.waiters.push({ pred, res: (v) => { clearTimeout(t); res(v); } }); }); }
  send(o) { this.ws.send(JSON.stringify(o)); }
  close() { try { this.ws.close(); } catch {} }
}
const rid = (p, i) => `${p}${Date.now().toString(36).slice(-4)}${i}`.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);

// ---------- Fuse
// the room name is computed ONCE per room: computing it per bot let a clock tick split one room in two
const rooms = Array.from({ length: FUSE_ROOMS }, (_, r) => { const id = rid("F", r); return Array.from({ length: BOTS }, (_, b) => new Bot("main", id, `bot${r}x${b}`)); });
const t0 = performance.now();
const opened = (await Promise.all(rooms.flat().map((b) => b.open()))).filter(Boolean).length;
check(`${FUSE_ROOMS * BOTS} sockets connected`, opened === FUSE_ROOMS * BOTS, `${opened} ok in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
await Promise.all(rooms.flat().map((b) => b.until((st) => st.players.length === BOTS, 10000)));
const full = rooms.filter((r) => r.every((b) => b.state?.players.length === BOTS)).length;
check(`every room sees all ${BOTS} players`, full === FUSE_ROOMS, `${full}/${FUSE_ROOMS}`);
for (const r of rooms) if (!r.every((b) => b.state?.players.length === BOTS))
  console.log(`  DIAG room ${r[0].room}: seen=[${r.map((b) => b.state?.players.length ?? 0)}] closed=[${r.map((b) => b.closed ?? "-")}] rejected=[${r.map((b) => b.rejected.join("+") || "-")}] bot0 history=[${r[0].counts}]`);

const lat = [];
await Promise.all(rooms.map(async (room) => {
  const t = performance.now();
  room.find((b) => b.pid === b.state.hostId).send({ type: "start" });
  const seen = await Promise.all(room.map((b) => b.until((s) => s.phase === "playing")));
  for (const s of seen) if (s) lat.push(s - t);
}));
check(`game start reaches every bot (p95 <= 150 ms)`, lat.length === FUSE_ROOMS * BOTS && pct(lat, 95) <= 150, `received ${lat.length}/${FUSE_ROOMS * BOTS}, p50 ${pct(lat, 50).toFixed(0)} ms p95 ${pct(lat, 95).toFixed(0)} ms p99 ${pct(lat, 99).toFixed(0)} ms`);

// reconnect storm: drop half of every room's sockets at once, reconnect them, expect seats restored
const dropped = rooms.map((room) => room.slice(0, BOTS / 2));
dropped.flat().forEach((b) => b.close());
await wait(800);
const reco = [];
const t1 = performance.now();
const fresh = dropped.map((d) => d.map((b) => new Bot("main", b.room, b.pid)));
await Promise.all(fresh.flat().map(async (b) => { await b.open(); const t = await b.until((s) => s.phase === "playing" && s.players.every((p) => p.connected), 10000); if (t) reco.push(t - t1); }));
check(`reconnect storm (${fresh.flat().length} sockets): all seats restored`, reco.length === fresh.flat().length, `${reco.length}/${fresh.flat().length}, p95 ${reco.length ? pct(reco, 95).toFixed(0) : "-"} ms`);
check("no lives or players lost in the storm", rooms.every((room, r) => fresh[r][0].state?.players.length === BOTS && fresh[r][0].state.players.every((p) => p.lives === 3)));
[...rooms.flat(), ...fresh.flat()].forEach((b) => b.close());
await wait(500);

// ---------- Quicklist: start, answer, done -> review
const qrooms = Array.from({ length: QL_ROOMS }, (_, r) => { const id = rid("Q", r); return Array.from({ length: 6 }, (_, b) => new Bot("quicklist", id, `q${r}x${b}`)); });
await Promise.all(qrooms.flat().map((b) => b.open()));
await Promise.all(qrooms.flat().map((b) => b.until((st) => st.players.length === 6, 10000)));
const qlat = []; let leaks = 0;
await Promise.all(qrooms.map(async (room) => {
  room.find((b) => b.pid === b.state.hostId).send({ type: "start" });
  await Promise.all(room.map((b) => b.until((s) => s.phase === "writing")));
  const L = room[0].state.letter;
  room.forEach((b, i) => b.send({ type: "answer", cat: 0, text: `${L}secret${i}` }));
  await wait(150);
  if (room.some((b, i) => room.some((o, j) => i !== j && JSON.stringify(b.state).includes(`secret${j}`)))) leaks++;
  const t = performance.now();
  room.forEach((b) => b.send({ type: "done" }));
  const seen = await Promise.all(room.map((b) => b.until((s) => s.phase === "review")));
  for (const s of seen) if (s) qlat.push(s - t);
}));
check(`quicklist: ${QL_ROOMS} rooms reached review (p95 <= 150 ms)`, qlat.length === QL_ROOMS * 6 && pct(qlat, 95) <= 150, `${qlat.length}/${QL_ROOMS * 6}, p95 ${pct(qlat, 95).toFixed(0)} ms`);
check("quicklist: no player ever saw another's draft while writing", leaks === 0, `${leaks} rooms leaked`);
qrooms.flat().forEach((b) => b.close());
console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
process.exit(fail ? 1 : 0);
