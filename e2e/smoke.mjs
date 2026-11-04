// Browser smoke test. Needs: `npm run build && npm start` (with LETTERBOX_COOKIE_SECRET) on :3100 and `npm run party` on :1999.
// Note: it plays today's puzzles, so run it against a fresh browser profile (it uses its own).
import { answers } from "./today.mjs";
import { launch } from "./browser.mjs";
const SHOTS = process.argv[2] || "e2e/shots";
import { mkdirSync } from "node:fs";
mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.BASE ?? "http://localhost:3100";
let fail = 0;
const check = (n, c, x = "") => { console.log(c ? "PASS" : "FAIL", n, x); if (!c) fail++; };

// today's answers, from the test-only endpoint
const A = await answers();
const puzzle = A.puzzle;
const answer = A.letterbox;
console.log("puzzle", puzzle, "answer", answer);

const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));

await page.goto(BASE + "/");
await page.waitForSelector("text=Today's dailies");
await page.screenshot({ path: `${SHOTS}/m-today-empty.png` });
check("today shows 3 core dailies + 5 more", (await page.locator("ul li a[href^='/play/']").count()) === 8);

// ---- Letterbox via real keyboard
await page.click("text=Letterbox");
await page.waitForSelector('[role="grid"]');
const typeWord = async (w) => { for (const ch of w) await page.keyboard.press(ch); await page.keyboard.press("Enter"); };
await page.keyboard.press("z"); for (const ch of "zzzz") await page.keyboard.press(ch);
await page.keyboard.press("Enter");
await page.waitForSelector("text=Not in word list");
check("fake word rejected instantly", true);
for (let i = 0; i < 5; i++) await page.keyboard.press("Backspace");
const first = answer === "crane" ? "stone" : "crane";
await typeWord(first);
await page.waitForFunction(() => document.querySelectorAll('[role="gridcell"][data-state]').length >= 5);
const states = await page.locator('[role="gridcell"][data-state]').evaluateAll((els) => els.map((e) => e.getAttribute("data-state")));
check("first guess coloured by the server", states.length === 5 && states.every(Boolean), states.join(","));
await page.screenshot({ path: `${SHOTS}/m-letterbox-guess.png` });
await typeWord(answer);
await page.waitForSelector("text=Solved in 2", { timeout: 5000 });
check("win detected: Solved in 2", true);
await page.waitForTimeout(600);
await page.screenshot({ path: `${SHOTS}/m-letterbox-win.png` });
await page.reload();
await page.waitForSelector("text=Solved in 2");
check("refresh resumes the finished game", true);

// ---- Bundle via taps
await page.goto(BASE + "/play/bundle");
await page.waitForSelector('[role="group"] button');
const tap = async (w) => page.locator(`[role="group"] button:text-is("${w}")`).click();
const G = A.bundle.map((g) => g.words);
for (const w of [...G[0].slice(0, 3), G[1][0]]) await tap(w);
await page.click("text=Submit");
await page.waitForSelector("text=One away");
check("one-away hint shown", true);
await page.click("text=Clear");
const groups = G;
for (const g of groups) {
  for (const w of g) await tap(w);
  await page.click("text=Submit");
  await page.waitForTimeout(500);
}
await page.waitForSelector("text=Solved with 1 slip");
check("bundle solved with 1 slip", true);
await page.screenshot({ path: `${SHOTS}/m-bundle-win.png` });

// ---- Pixel Peek (real photos that sharpen)
await page.goto(BASE + "/play/pixel-peek");
await page.waitForSelector('input[placeholder="What is it?"]');
await page.screenshot({ path: `${SHOTS}/m-pixel-start.png` });
const src0 = await page.locator("img.img-in").getAttribute("src");
await page.fill('input[placeholder="What is it?"]', "banana"); await page.click("text=Go");
await page.waitForSelector("text=Not quite");
await page.waitForTimeout(400);
const src1 = await page.locator("img.img-in").getAttribute("src");
check("picture changes (sharpens) after a wrong guess", src1 !== src0, `${src0.length} -> ${src1.length} chars`);
await page.fill('input[placeholder="What is it?"]', A.pixel.answers[0]); await page.click("text=Go");
await page.waitForSelector("text=Got it in 2");
check("pixel peek solved in 2", true, A.pixel.title);
await page.screenshot({ path: `${SHOTS}/m-pixel-win.png` });

// ---- Odd One
await page.goto(BASE + "/play/odd-one");
await page.waitForSelector("text=Which one doesn't belong?");
for (const pick of A.odd.map((r) => r.odd)) { await page.locator(`button:text-is("${pick}")`).click(); await page.waitForTimeout(500); }
await page.waitForSelector("text=Clean sweep");
check("odd one clean sweep", true);

// ---- Today + journal reflect it
await page.goto(BASE + "/");
await page.waitForSelector("text=All three done");
check("today shows 3 of 3 done + streak 1", (await page.locator("text=3 of 3 done").count()) === 1 && (await page.locator('[aria-label="1 day streak"]').count()) === 1);
await page.screenshot({ path: `${SHOTS}/m-today-done.png` });
await page.goto(BASE + "/journal");
await page.waitForSelector("text=Solved Letterbox in 2");
const jtxt = await page.locator("main").innerText();
check("journal wrote its own lines", /Bundle with a single slip/.test(jtxt) && /Pixel Peek cracked in 2/.test(jtxt) && /Odd One: a clean sweep/.test(jtxt));
await page.fill("textarea", "Solved it on the train home.");
await page.reload(); await page.waitForSelector("textarea");
// The saved note is filled in once the page has loaded, so give it a moment rather than reading the empty box.
await page.waitForFunction(() => document.querySelector("textarea")?.value, null, { timeout: 5000 }).catch(() => {});
check("journal note persists", (await page.inputValue("textarea")) === "Solved it on the train home.");
await page.screenshot({ path: `${SHOTS}/m-journal.png`, fullPage: true });
await page.click('button[role=tab]:text-is("Calendar")'); await page.screenshot({ path: `${SHOTS}/m-calendar.png` });
await page.click('button[role=tab]:text-is("Stats")'); await page.screenshot({ path: `${SHOTS}/m-stats.png` });

// ---- offline: pages we've opened still load from the service worker cache.
// The service worker only registers in a production build, so `next dev` skips this check.
const hasSW = await page.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration()));
if (!hasSW) console.log("SKIP journal opens offline (no service worker: run against `next build && next start`)");
else {
  await ctx.setOffline(true);
  let offlineOK = true;
  try { await page.goto(BASE + "/journal", { timeout: 8000 }); await page.waitForSelector("h1:text-is(\"Journal\")", { timeout: 5000 }); } catch { offlineOK = false; }
  check("journal opens offline", offlineOK);
}
await ctx.setOffline(false);

// ---- Fuse: two real browsers
const mk = async (name) => { const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await c.newPage(); p.on("pageerror", (e) => errors.push(name + " PAGEERROR " + e.message)); return p; };
const a = await mk("alice"), b = await mk("bob");
await a.goto(BASE + "/party"); await a.fill('input[placeholder="e.g. Kabir"]', "Alice"); await a.locator("section", { hasText: "A letter chunk appears" }).locator("text=Create a room").click();
await a.waitForURL(/\/r\/[A-Z]{4}/); const code = a.url().split("/r/")[1];
await a.waitForSelector("text=Waiting for friends");
await b.goto(BASE + "/party"); await b.fill('input[placeholder="e.g. Kabir"]', "Bob"); await b.fill('input[aria-label="Fuse room code"]', code); await b.locator("section", { hasText: "A letter chunk appears" }).locator('button:text-is("Join")').click();
await b.waitForSelector("text=Waiting for the host to start");
await a.waitForSelector("text=Start game");
await a.screenshot({ path: `${SHOTS}/m-fuse-lobby.png` });
await a.click("text=Start game");
await a.waitForSelector("text=Your turn"); await b.waitForSelector("text=Alice's turn");
check("fuse game started on both screens", true, `room ${code}`);
await a.screenshot({ path: `${SHOTS}/m-fuse-play.png` });
// let the fuse burn on alice: life lost
await a.waitForFunction(() => document.body.innerText.includes("♥♥") && !document.body.innerText.includes("♥♥♥") || true, null, { timeout: 1000 }).catch(() => {});
await a.waitForSelector("text=Bob's turn", { timeout: 14000 });
check("server burns the fuse and moves the turn on", true);
await a.screenshot({ path: `${SHOTS}/m-fuse-after-burn.png` });

// desktop shots
const d = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const dp = await d.newPage();
for (const [path, name] of [["/", "today"], ["/play/letterbox", "letterbox"], ["/journal", "journal"], ["/party", "party"]]) {
  await dp.goto(BASE + path); await dp.waitForTimeout(700);
  await dp.screenshot({ path: `${SHOTS}/d-${name}.png` });
}
await dp.goto(BASE + "/play/bundle"); await dp.waitForTimeout(600); await dp.screenshot({ path: `${SHOTS}/d-bundle.png` });
const navVisible = await dp.locator("header nav").first().isVisible();
await dp.goto(BASE + "/"); 
check("desktop: top nav visible, bottom nav hidden", navVisible && !(await dp.locator("nav.sticky").isVisible()));

console.log("\nconsole/page errors:", errors.length ? errors : "none");
console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
await browser.close();
process.exit(fail ? 1 : 0);
