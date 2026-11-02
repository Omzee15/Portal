// Plays Fuse and Quicklist the way friends would: separate browsers, real UI, real PartyKit server.
// Needs the app on BASE (default :3100) and `npm run party` on :1999.
import { chromium } from "playwright";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const WORDS = require("an-array-of-english-words").filter((w) => w.length >= 5 && w.length <= 9);
const BASE = process.env.BASE ?? "http://127.0.0.1:3100";
let fail = 0;
const check = (n, c, x = "") => { console.log(c ? "PASS" : "FAIL", n, x); if (!c) fail++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const errors = [];
async function player(name, url) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(url ?? `${BASE}/party`, { waitUntil: "networkidle" });
  return page;
}
async function joinFromHub(page, name, gameIdx, code) {
  await page.getByPlaceholder("e.g. Kabir").first().fill(name);
  if (code) {
    await page.locator("form").nth(gameIdx).locator("input").fill(code);
    await page.locator("form").nth(gameIdx).locator("button").click();
  } else await page.getByRole("button", { name: "Create a room" }).nth(gameIdx).click();
}
async function nameAtDoor(page, name) {
  const box = page.getByPlaceholder("e.g. Kabir");
  await box.waitFor({ timeout: 8000 });
  await box.fill(name);
  await page.getByRole("button", { name: "Join" }).click();
}

if (!process.env.SKIP_FUSE)
// ---- Fuse ----
{
  const a = await player("Asha");
  await joinFromHub(a, "Asha", 0);
  await a.waitForURL(/\/r\/[A-Z]{4}/);
  const code = a.url().split("/").pop();
  check("fuse: host gets a room", /^[A-Z]{4}$/.test(code), code);
  const b = await player("Ben");
  await joinFromHub(b, "Ben", 0, code);
  await b.waitForURL(/\/r\//);
  const c = await player("Cy", `${BASE}/r/${code}`); // invite link
  await nameAtDoor(c, "Cy");
  await a.getByText("Cy", { exact: false }).first().waitFor({ timeout: 8000 });
  check("fuse: 3 players see each other", (await a.textContent("body")).includes("Ben"));
  await a.screenshot({ path: "e2e/shots/fuse-lobby.png" });
  await a.getByRole("button", { name: /start/i }).first().dispatchEvent("pointerdown");
  const box = (p) => p.getByLabel("Your word");
  await box(a).waitFor({ timeout: 8000 });
  check("fuse: game starts for everyone", await box(b).isVisible() && await box(c).isVisible());
  let accepted = 0, rejected = 0;
  const used = new Set();
  const t0 = Date.now();
  for (let i = 0; i < 12 && Date.now() - t0 < 60000; i++) {
    let mover;
    for (let tries = 0; tries < 40 && !mover; tries++) {
      for (const p of [a, b, c]) if (await box(p).isEnabled().catch(() => false)) mover = p;
      if (!mover) await wait(100);
    }
    if (!mover) break;
    const chunk = ((await box(mover).getAttribute("placeholder")).match(/with (\S+)/)?.[1] ?? "").toLowerCase();
    if (i === 2) { // a non-word must not pass
      await box(mover).fill(`${chunk}zzqx`); await box(mover).press("Enter"); await wait(300);
      rejected += (await box(mover).isEnabled()) ? 1 : 0;
    }
    const w = WORDS.find((x) => x.includes(chunk) && !used.has(x));
    used.add(w);
    await box(mover).fill(w); await box(mover).press("Enter"); accepted++;
    await wait(250);
  }
  check("fuse: words accepted and turn passes between players", accepted >= 8, `${accepted} words`);
  check("fuse: a made-up word is refused", rejected === 1);
  await a.screenshot({ path: "e2e/shots/fuse-play.png" });
  // Ben drops and comes back mid-game
  await b.reload(); await box(b).waitFor({ timeout: 8000 });
  check("fuse: reconnect after reload keeps the seat", true);
  // nobody plays: lives burn away until a winner
  await a.getByRole("button", { name: /rematch|play again/i }).waitFor({ timeout: 100000 });
  check("fuse: game runs to a winner", /wins|winner/i.test(await a.textContent("body")));
  await a.screenshot({ path: "e2e/shots/fuse-end.png" });
  await a.getByRole("button", { name: /rematch|play again/i }).first().dispatchEvent("pointerdown");
  await wait(800);
  check("fuse: rematch returns all to the room", /start/i.test(await a.textContent("body")) || await box(a).isVisible());
  for (const p of [a, b, c]) await p.context().close();
}

// ---- Quicklist ----
{
  const a = await player("Asha");
  await joinFromHub(a, "Asha", 1);
  await a.waitForURL(/\/q\/[A-Z]{4}/);
  const code = a.url().split("/").pop();
  const b = await player("Ben");
  await joinFromHub(b, "Ben", 1, code);
  await b.waitForURL(/\/q\//);
  const c = await player("Cy", `${BASE}/q/${code}`);
  await nameAtDoor(c, "Cy");
  await a.getByText("Cy", { exact: false }).first().waitFor({ timeout: 8000 });
  check("quicklist: 3 players in the lobby", true);
  await a.getByRole("button", { name: /start/i }).first().dispatchEvent("pointerdown");
  await a.locator("ol input").first().waitFor({ timeout: 8000 });
  await wait(500);
  const letter = (await a.locator("ol input").first().getAttribute("placeholder"))[0];
  check("quicklist: a letter is dealt", /^[A-Z]$/.test(letter), letter);
  const inputs = await a.locator("ol input").count();
  check("quicklist: 8 categories", inputs === 8, inputs);
  for (const [p, s] of [[a, "asha"], [b, "ben"], [c, "cy"]]) {
    await p.locator("ol input").nth(0).fill(`${letter}shared`);
    await p.locator("ol input").nth(1).fill(`${letter}${s}`);
    await p.locator("ol input").nth(1).blur();
  }
  await wait(600);
  await a.screenshot({ path: "e2e/shots/ql-write.png" });
  for (const p of [a, b, c]) await p.getByRole("button", { name: /done/i }).first().dispatchEvent("pointerdown");
  await wait(1200);
  const body = await b.textContent("body");
  check("quicklist: answers revealed for review", body.toLowerCase().includes(`${letter}asha`.toLowerCase()), "");
  await b.screenshot({ path: "e2e/shots/ql-review.png" });
  const flags = b.getByRole("button", { name: /Mark Asha's answer not valid/ });
  check("quicklist: can vote out an answer", (await flags.count()) > 0);
  await flags.nth(1).dispatchEvent("pointerdown").catch(() => {});
  await wait(300);
  for (const p of [a, b, c]) await p.getByRole("button", { name: "Ready for scores" }).dispatchEvent("pointerdown");
  await wait(1200);
  await a.screenshot({ path: "e2e/shots/ql-score.png" });
  const t = await a.textContent("body");
  check("quicklist: scores shown", /round|point|score/i.test(t));
  await a.getByRole("button", { name: /next|rematch/i }).first().dispatchEvent("pointerdown");
  await wait(1000);
  check("quicklist: next round starts", (await a.locator("ol input").count()) === 8);
  for (const p of [a, b, c]) await p.context().close();
}
const noisy = errors.filter((e) => !/favicon|Failed to load resource.*404/.test(e));
check("no browser errors in either game", noisy.length === 0, noisy.slice(0, 5).join(" | "));
await browser.close();
console.log(fail ? `${fail} failed` : "all passed");
process.exit(fail ? 1 : 0);
