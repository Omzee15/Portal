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
for (const [h, want] of [["x-content-type-options", "nosniff"], ["x-frame-options", "DENY"], ["referrer-policy", "strict-origin-when-cross-origin"], ["permissions-policy", "camera=()"], ["content-security-policy", "frame-ancestors 'none'"], ["content-security-policy", "default-src 'self'"], ["content-security-policy", "object-src 'none'"], ["strict-transport-security", "max-age="]])
  check(`header ${h}`, (home.headers.get(h) ?? "").includes(want), home.headers.get(h) ?? "(missing)");

// ---- 5. The test-answers endpoint is never public
const t = await fetch(BASE + "/api/e2e-answers");
if (process.env.PORTAL_E2E !== "1") check("test-answers endpoint is closed (404)", t.status === 404, `HTTP ${t.status}`);

// ---- 6. Rate limiting (run this against a server with the limiter ON: it is off if RATE_LIMIT_DISABLED=1)
const burst = await Promise.all(Array.from({ length: 200 }, (_, n) => fetch(BASE + "/api/letterbox/guess", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ guess: "crane", clientActionId: "burst" + String(n).padStart(8, "0") }) })));
const limited = burst.filter((r) => r.status === 429);
check("a burst of 200 rapid guesses is rate limited", limited.length > 0 && limited.every((r) => r.headers.get("retry-after")), `${limited.length} of 200 got 429 with Retry-After`);
check("the first requests of a burst still go through (normal play isn't limited)", burst.filter((r) => r.status !== 429).length >= 60, `${burst.filter((r) => r.status !== 429).length} allowed`);
const health = await (await fetch(BASE + "/api/health")).json().catch(() => ({}));
check("health endpoint reports every game ready", health.status === "ok" && Object.values(health.checks ?? {}).every(Boolean), JSON.stringify(health.checks ?? {}).slice(0, 60));
for (const [path, word] of [["/privacy", "Privacy"], ["/terms", "Terms of use"], ["/definitely-not-a-page", "Nothing here"]]) {
  const r = await fetch(BASE + path);
  check(`page ${path} renders ${path.includes("definitely") ? "the 404 page" : "its content"}`, (await r.text()).includes(word), `HTTP ${r.status}`);
}

console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
process.exit(fail ? 1 : 0);
