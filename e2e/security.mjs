// Security checks against a running production build. Needs the web server on :3100.
import fs from "node:fs";
import path from "node:path";
const BASE = process.env.BASE || "http://localhost:3100";
let fail = 0;
const check = (n, c, x = "") => { console.log(c ? "PASS" : "FAIL", n, x); if (!c) fail++; };

// ---- 1. Secrets must never reach the browser's JavaScript
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const bundle = walk(".next/static").filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(f, "utf8")).join("\n");
const answers = JSON.parse(fs.readFileSync("src/lib/letterbox/answers.json", "utf8"));
const emoji = JSON.parse(fs.readFileSync("src/lib/emoji/puzzles.json", "utf8"));
const splice = JSON.parse(fs.readFileSync("src/lib/splice/pool.json", "utf8"));
const leaks = {
  "letterbox answer lists": ["medium", "hard", "expert"].filter((t) => bundle.includes(JSON.stringify(answers[t].slice(0, 4)).slice(1, -1))).length,
  "emoji puzzle titles": emoji.slice(-12).filter((p) => bundle.includes(p.title)).length,
  "wordsplice clue pool": splice.slice(100, 140).filter((e) => bundle.includes(e.c)).length,
  "ladder pairs": bundle.includes(JSON.parse(fs.readFileSync("src/lib/ladder/ladders.json", "utf8")).hard[0]) ? 1 : 0,
  "category database": bundle.includes('"id":"fruits"') ? 1 : 0,
  "cookie signing secret": bundle.includes("dev-only-secret") ? 1 : 0,
};
for (const [k, n] of Object.entries(leaks)) check(`no ${k} in client JavaScript`, n === 0);

// ---- 2. Malformed input must be refused politely, never crash (no 5xx)
const posts = ["/api/letterbox/guess", "/api/bundle/guess", "/api/pixel/guess", "/api/emoji/guess", "/api/odd/guess", "/api/ladder/step", "/api/ladder/giveup", "/api/splice/check", "/api/sudoku/check"];
const bodies = ["{", "null", "[]", '"str"', '{"guess":123,"clientActionId":[]}', '{"words":"x","tiles":{},"grid":42}', "x".repeat(300000), JSON.stringify({ guess: "a".repeat(100000), clientActionId: "abcdefgh01" })];
let serverErrors = 0, total = 0;
for (const url of posts) for (const body of bodies) {
  const r = await fetch(BASE + url, { method: "POST", headers: { "content-type": "application/json" }, body }).catch(() => ({ status: 0 }));
  total++; if (r.status >= 500 || r.status === 0) { serverErrors++; console.log("  5xx:", url, body.slice(0, 30), r.status); }
}
check(`${total} malformed requests: none caused a server error`, serverErrors === 0, `${serverErrors} errors`);

// ---- 3. Guess endpoint rules
const jar = {};
const g = (guess, id) => fetch(BASE + "/api/letterbox/guess", { method: "POST", headers: { "content-type": "application/json", cookie: jar.c ?? "" }, body: JSON.stringify({ guess, clientActionId: id }) }).then(async (r) => { const c = r.headers.get("set-cookie"); if (c) jar.c = c.split(";")[0]; jar.raw = c; return { s: r.status, j: await r.json() }; });
const first = await g("crane", "sec00000001");
check("a first valid guess is accepted", first.s === 200);
check("the answer is not in an unfinished game's response", !("answer" in first.j) || first.j.answer === undefined);
const cookie = jar.raw ?? "";
check("attempt cookie is HttpOnly", /httponly/i.test(cookie));
check("attempt cookie is SameSite", /samesite=lax/i.test(cookie));
if (BASE.startsWith("https") || process.env.CHECK_SECURE === "1") check("attempt cookie is Secure on HTTPS", /;\s*secure/i.test(cookie));
const forged = await fetch(BASE + "/api/letterbox/guess", { method: "POST", headers: { "content-type": "application/json", cookie: "lb_attempt=1.0.x.AAAA" }, body: JSON.stringify({ guess: "stone", clientActionId: "sec00000002" }) });
check("a forged attempt cookie is ignored, not trusted", forged.status === 200 && (await forged.json()).step === 1);

// ---- 4. Hardening headers
const home = await fetch(BASE + "/");
for (const [h, want] of [["x-content-type-options", "nosniff"], ["x-frame-options", "DENY"], ["referrer-policy", "strict-origin-when-cross-origin"], ["permissions-policy", "camera=()"]])
  check(`header ${h}`, (home.headers.get(h) ?? "").includes(want), home.headers.get(h) ?? "(missing)");

// ---- 5. The test-answers endpoint is never public
const t = await fetch(BASE + "/api/e2e-answers");
if (process.env.PORTAL_E2E !== "1") check("test-answers endpoint is closed (404)", t.status === 404, `HTTP ${t.status}`);

console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
process.exit(fail ? 1 : 0);
