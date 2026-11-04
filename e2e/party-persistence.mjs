// Starts its own party server on :1998, plays into a game, kills the server hard, starts a new one, and checks the rooms survived.
import { spawn } from "node:child_process";
const PORT = 1998, HOST = `127.0.0.1:${PORT}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const check = (n, c, x = "") => { console.log(c ? "PASS" : "FAIL", n, x); if (!c) fail++; };

let proc;
async function startServer() {
  proc = spawn("npx", ["partykit", "dev", "--port", String(PORT)], { detached: true, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { try { await fetch(`http://${HOST}/`); return; } catch { await wait(500); } }
  throw new Error("party server did not start");
}
const killServer = () => { try { process.kill(-proc.pid, "SIGKILL"); } catch {} };
process.on("exit", killServer);

class Bot {
  constructor(party, room, pid) { this.party = party; this.room = room; this.pid = pid; this.state = null; this.waiters = []; }
  open() { return new Promise((res) => { this.ws = new WebSocket(`ws://${HOST}/parties/${this.party}/${this.room}?pid=${this.pid}&name=${this.pid}`);
    this.ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === "state") { this.state = m.state; this.waiters = this.waiters.filter((w) => !(w.p(m.state) && (w.r(1), true))); } };
    this.ws.onopen = () => res(true); this.ws.onerror = () => res(false); }); }
  until(p, ms = 8000) { return new Promise((r) => { if (this.state && p(this.state)) return r(1); const t = setTimeout(() => r(null), ms); this.waiters.push({ p, r: (v) => { clearTimeout(t); r(v); } }); }); }
  send(o) { this.ws.send(JSON.stringify(o)); }
}
const tag = Math.random().toString(36).slice(2, 6).toUpperCase();

await startServer();
// ---- before the crash
const fuse = ["a", "b", "c"].map((n) => new Bot("main", `PF${tag}`, `pf${n}`));
await Promise.all(fuse.map((b) => b.open())); await Promise.all(fuse.map((b) => b.until((s) => s.players.length === 3)));
fuse.find((b) => b.pid === b.state.hostId).send({ type: "start" });
await Promise.all(fuse.map((b) => b.until((s) => s.phase === "playing")));
const fuseBefore = fuse[0].state;

const ql = ["a", "b", "c"].map((n) => new Bot("quicklist", `PQ${tag}`, `pq${n}`));
await Promise.all(ql.map((b) => b.open())); await Promise.all(ql.map((b) => b.until((s) => s.players.length === 3)));
ql.find((b) => b.pid === b.state.hostId).send({ type: "start" });
await Promise.all(ql.map((b) => b.until((s) => s.phase === "writing")));
const L = ql[0].state.letter, cats = ql[0].state.categories.join("|");
ql[0].send({ type: "answer", cat: 0, text: `${L}draftkept` });
await wait(1200); // let the room save

// ---- crash: no goodbye, no clean shutdown
[...fuse, ...ql].forEach((b) => { try { b.ws.close(); } catch {} });
killServer(); await wait(1500);
await startServer(); await wait(1500);

// ---- after: same players come back
const fuse2 = ["a", "b", "c"].map((n) => new Bot("main", `PF${tag}`, `pf${n}`));
await Promise.all(fuse2.map((b) => b.open()));
const back = await Promise.all(fuse2.map((b) => b.until((s) => s.players.every((p) => p.connected), 8000)));
const f = fuse2[0].state;
check("fuse: the room survived a hard server kill", !!f && f.phase !== "lobby", `phase ${f?.phase}`);
check("fuse: all 3 players kept their seats", f?.players.length === 3 && back.every(Boolean));
check("fuse: used words and turn counter were kept", f?.turns >= fuseBefore.turns && f?.used.length >= fuseBefore.used.length, `turns ${fuseBefore.turns} -> ${f?.turns}`);
check("fuse: a stranger still can't join the game in progress", await (async () => { const x = new Bot("main", `PF${tag}`, "pfintruder"); await x.open(); await wait(500); return !x.state; })());

const ql2 = ["a", "b", "c"].map((n) => new Bot("quicklist", `PQ${tag}`, `pq${n}`));
await Promise.all(ql2.map((b) => b.open()));
await Promise.all(ql2.map((b) => b.until((s) => s.players.length === 3 && s.players.every((p) => p.connected), 8000)));
const q = ql2[0].state;
check("quicklist: round, letter and categories survived", q?.phase === "writing" && q.letter === L && q.categories.join("|") === cats, `phase ${q?.phase}, letter ${q?.letter}`);
check("quicklist: a player's draft answer was restored", q?.answers?.pqa?.[0] === `${L}draftkept`);
check("quicklist: other players' drafts are still hidden", !JSON.stringify(ql2[1].state).includes("draftkept"));

killServer();
console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
process.exit(fail ? 1 : 0);
