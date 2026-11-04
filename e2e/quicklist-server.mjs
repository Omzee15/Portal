// Quicklist room over real WebSockets. Needs `npm run party` on :1999.
const ROOM = "QL" + Math.floor(Math.random() * 90000);
const url = (pid) => `ws://${process.env.PARTY ?? "127.0.0.1:1999"}/parties/quicklist/${ROOM}?pid=${pid}&name=${pid}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const check = (n, c, x = "") => { console.log(c ? "PASS" : "FAIL", n, x); if (!c) fail++; };
function client(pid) {
  const c = { state: null, rejected: [], closed: null };
  c.ws = new WebSocket(url(pid));
  c.ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === "state") c.state = m.state; if (m.type === "rejected") c.rejected.push(m.reason); };
  c.ws.onclose = (e) => (c.closed = e.code);
  c.send = (o) => c.ws.send(JSON.stringify(o));
  return c;
}
let a = client("ann"); await wait(400); // first in becomes host
const b = client("ben"), c = client("cy");
await wait(1200);
check("three players in the lobby, ann is host", a.state?.players.length === 3 && a.state.hostId === "ann");
b.send({ type: "start" }); await wait(300);
check("non-host cannot start", b.rejected.includes("not_host"));
a.send({ type: "start" }); await wait(500);
check("round 1 starts with a letter and 8 categories", a.state.phase === "writing" && /^[A-Z]$/.test(a.state.letter) && a.state.categories.length === 8, `letter ${a.state.letter}`);
const L = a.state.letter;
a.send({ type: "answer", cat: 0, text: `${L}secretword` }); await wait(300);
check("other players never receive ann's draft while writing", !JSON.stringify(b.state).includes("secretword") && !JSON.stringify(c.state).includes("secretword"));
a.ws.close(); await wait(500);
a = client("ann"); await wait(800);
check("ann reconnects mid-round and gets her own draft back", a.state?.phase === "writing" && a.state.answers.ann?.[0] === `${L}secretword`);
b.send({ type: "answer", cat: 0, text: `${L}same` }); c.send({ type: "answer", cat: 0, text: `${L}same` });
b.send({ type: "answer", cat: 1, text: `${L}bwonly` }); c.send({ type: "answer", cat: 1, text: `${L}cwonly` });
await wait(300);
check("still writing until someone is done", a.state.phase === "writing");
c.send({ type: "done" }); await wait(400);
check("done is refused in the first 30 seconds", c.rejected.includes("too_soon") && a.state.phase === "writing");
await wait(30_500 - 1500); c.send({ type: "done" }); await wait(400);
check("one player finishing ends the round for all, answers now visible to all", a.state.phase === "review" && b.state.answers.ann?.[0] === `${L}secretword`);
// nothing here is on a list, so an answer scores only if the group accepts it
a.send({ type: "flag", owner: "ben", cat: 1 }); a.send({ type: "flag", owner: "cy", cat: 1 });
a.send({ type: "flag", owner: "ben", cat: 0 }); a.send({ type: "flag", owner: "cy", cat: 0 }); await wait(300);
a.send({ type: "flag", owner: "ann", cat: 0 }); await wait(200);
check("cannot flag your own answer", a.rejected.includes("cannot_flag_own"));
for (const x of [a, b, c]) x.send({ type: "ready" });
await wait(500);
check("round results: scoring applied", a.state.phase === "results", JSON.stringify(a.state.players.map((p) => `${p.id}:${p.total}`)));
const tot = Object.fromEntries(a.state.players.map((p) => [p.id, p.total]));
check("ann's unaccepted answer scored 0, the duplicate cancelled (0), accepted unique answers score 1", tot.ann === 0 && tot.ben === 1 && tot.cy === 1, JSON.stringify(tot));
b.send({ type: "next" }); await wait(300);
check("only the host can advance", b.rejected.includes("not_host"));
a.send({ type: "next" }); await wait(400);
check("round 2 with a different letter", a.state.round === 2 && a.state.phase === "writing" && a.state.letter !== L, `letter ${a.state.letter}`);
const late = client("zed"); await wait(600);
check("late joiner refused mid-game", late.rejected.includes("in_progress") && late.closed === 4001);
for (const x of [a, b, c, late]) x.ws.close();
console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
process.exit(fail ? 1 : 0);
