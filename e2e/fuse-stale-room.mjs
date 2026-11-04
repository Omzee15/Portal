// A finished Fuse room that everyone has left must reset to a fresh lobby. Takes ~65s. Needs `npm run party`.
const ROOM = "STAL" + Math.floor(Math.random() * 9000);
const url = (pid) => `ws://${process.env.PARTY ?? "127.0.0.1:1999"}/parties/main/${ROOM}?pid=${pid}&name=${pid}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function client(pid) { const c = { state: null, rejected: [], closed: null }; c.ws = new WebSocket(url(pid)); c.ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === "state") c.state = m.state; if (m.type === "rejected") c.rejected.push(m.reason); }; c.ws.onclose = (e) => (c.closed = e.code); c.send = (o) => c.ws.send(JSON.stringify(o)); return c; }
const a = client("alice"); await wait(500); const b = client("bob"); await wait(500);
a.send({ type: "start" }); await wait(400);
console.log("started:", a.state?.phase);
a.ws.close(); b.ws.close();
console.log("everyone left mid-game; waiting 62s for the seat hold to expire...");
await wait(62000);
const c = client("carol"); await wait(800);
const refused = c.rejected.includes("in_progress") || c.closed === 4001;
console.log(refused ? "BUG   new player refused: room stuck after everyone left" : "ok    new player can join a fresh lobby", "| phase seen:", c.state?.phase, "players:", c.state?.players?.length);
c.ws.close(); process.exit(0);
