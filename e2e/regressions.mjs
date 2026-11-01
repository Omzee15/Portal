// Regression tests for bugs that were found and fixed. Needs the web server on :3100 and `npm run party` on :1999.
import { launch } from "./browser.mjs";
const BASE = "http://localhost:3100";
import { answers as getAnswers } from "./today.mjs";
const A = await getAnswers();
import { mkdirSync } from "node:fs";
mkdirSync("e2e/shots", { recursive: true });
const b = await launch();
const out = (n, bug, x = "") => console.log(bug ? "BUG   " : "ok    ", n, x);

// A) Odd One: reload mid-game
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(BASE + "/play/odd-one");
  await p.waitForSelector("text=Which one doesn't belong?");
  await p.locator(`button:text-is("${A.odd[0].items[0]}")`).click();
  await p.waitForSelector("text=ROUND 2/3");
  await p.reload();
  await p.waitForTimeout(1500);
  const txt = await p.locator("main, body").first().innerText();
  out("A) Odd One survives a reload mid-game", /Clean sweep|of 3/.test(txt) && !/ROUND 2\/3/.test(txt), /ROUND 2\/3/.test(txt) ? "" : "-> game was ended by the reload");
}
// A2) Odd One timer cost: how many callbacks per second?
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => { const o = window.setInterval; window.__n = 0; window.setInterval = (f, d, ...a) => { window.__delays = (window.__delays || []).concat(String(d)); return o(f, d, ...a); }; });
  await p.goto(BASE + "/play/odd-one");
  await p.waitForSelector("text=Which one doesn't belong?");
  const delays = await p.evaluate(() => window.__delays);
  out("A2) Odd One interval has a real delay", delays.some((d) => d === "undefined"), JSON.stringify(delays));
}
// B) Letterbox: extra guess right after a win
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const answer = A.letterbox;
  await p.goto(BASE + "/play/letterbox");
  await p.waitForSelector('[role="grid"]');
  const type = async (w) => { for (const c of w) await p.keyboard.press(c); await p.keyboard.press("Enter"); };
  await type(answer);
  await p.waitForTimeout(150); // the win is not "settled" yet (flip still running)
  await type("crane");
  await p.waitForTimeout(1500);
  const rows = await p.locator('[role="row"]').evaluateAll((rs) => rs.filter((r) => r.textContent.trim().length > 0).length);
  out("B) no extra guess accepted after a win", rows > 1, `rows with letters: ${rows}`);
}
// C) Fuse chunk visibility a second after the turn starts
{
  const mk = async () => { const c = await b.newContext({ viewport: { width: 390, height: 844 } }); return c.newPage(); };
  const a = await mk(), bb = await mk();
  await a.goto(BASE + "/party"); await a.fill('input[placeholder="e.g. Kabir"]', "Al"); await a.locator("section", { hasText: "A letter chunk appears" }).locator("text=Create a room").click();
  await a.waitForURL(/\/r\/[A-Z]{4}/); const code = a.url().split("/r/")[1];
  await bb.goto(BASE + "/party"); await bb.fill('input[placeholder="e.g. Kabir"]', "Bo"); await bb.fill('input[aria-label="Fuse room code"]', code); await bb.locator("section", { hasText: "A letter chunk appears" }).locator('button:text-is("Join")').click();
  await a.waitForSelector("text=Start game"); await a.click("text=Start game"); await a.waitForSelector("text=Your turn");
  await a.waitForTimeout(1500);
  const op = await a.locator('[aria-label^="Letters:"]').evaluate((e) => getComputedStyle(e).opacity);
  out("C) Fuse chunk fully opaque after animation", Number(op) < 1, `opacity=${op}`);
  await a.screenshot({ path: "e2e/shots/c-fuse.png" });
}
// D) Pixel Peek: two wrong guesses unlock the first hint (keeps expert-day pictures winnable)
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(BASE + "/play/pixel-peek"); await p.waitForSelector('input[placeholder="What is it?"]');
  await p.fill('input[placeholder="What is it?"]', "zzzfirst"); await p.click("text=Go"); await p.waitForSelector("text=Not quite");
  const afterOne = await p.locator("text=HINT 1").count();
  await p.fill('input[placeholder="What is it?"]', "zzzsecond"); await p.click("text=Go");
  await p.waitForSelector("text=HINT 1", { timeout: 5000 }).catch(() => {});
  const afterTwo = await p.locator("text=HINT 1").count();
  out("D) pixel peek hint appears only after the 2nd wrong guess", !(afterOne === 0 && afterTwo === 1), `after 1: ${afterOne}, after 2: ${afterTwo}`);
  await p.reload(); await p.waitForSelector('input[placeholder="What is it?"]');
  out("D2) the hint survives a reload", (await p.locator("text=HINT 1").count()) !== 1);
}
await b.close();
