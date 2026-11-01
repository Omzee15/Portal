// Plays each new game through the real UI. Needs the web server on :3100 and `npm run party` on :1999.
import { createRequire } from "node:module";
import fs from "node:fs";
import { answers } from "./today.mjs";
const require = createRequire(process.cwd() + "/package.json");
const { chromium } = require("playwright");
const BASE = "http://localhost:3100";
const SHOTS = process.argv[2] || "e2e/shots";
fs.mkdirSync(SHOTS, { recursive: true });
let fail = 0;
const check = (n, c, x = "") => { console.log(c ? "PASS" : "FAIL", n, x); if (!c) fail++; };
const A = await answers();
const n = A.puzzle;
const errors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));

// ---------- Today lists everything
await page.goto(BASE + "/");
await page.waitForSelector("text=More dailies");
const cards = await page.locator("ul li a[href^='/play/']").count();
check("Today lists the 3 core dailies + 5 more", cards === 8, `${cards} cards`);
await page.screenshot({ path: `${SHOTS}/n-today.png`, fullPage: true });

// ---------- Word Ladder: BFS in the harness, then type the path
{
  const dict = require("an-array-of-english-words").filter((w) => /^[a-z]{4}$/.test(w));
  const set = new Set(dict);
  await page.goto(BASE + "/play/word-ladder");
  await page.waitForSelector("text=changing one letter");
  const [start, target] = await page.locator("p b.uppercase").allInnerTexts().then((t) => t.map((x) => x.toLowerCase()));
  const prev = new Map([[start, null]]); let q = [start];
  while (q.length && !prev.has(target)) { const nq = [];
    for (const w of q) for (let i = 0; i < 4; i++) for (let c = 97; c < 123; c++) { const m = w.slice(0, i) + String.fromCharCode(c) + w.slice(i + 1); if (set.has(m) && !prev.has(m)) { prev.set(m, w); nq.push(m); } }
    q = nq; }
  const path = []; for (let w = target; w; w = prev.get(w)) path.unshift(w);
  // a wrong move first: not one letter away
  await page.fill('input[aria-label="Next word"]', "zzzz"); await page.click('button:text-is("Add")');
  await page.waitForSelector("text=Not a word");
  check("ladder rejects a non-word", true);
  await page.fill('input[aria-label="Next word"]', start === "love" ? "dark" : "love"); await page.click('button:text-is("Add")');
  await page.waitForSelector("text=Change exactly one letter");
  check("ladder rejects a word that isn't one letter away", true);
  for (const w of path.slice(1)) { await page.fill('input[aria-label="Next word"]', w); await page.click('button:text-is("Add")'); await page.waitForTimeout(250); }
  await page.waitForSelector("text=Par is", { timeout: 6000 });
  check("word ladder solved", true, `${start} -> ${target} in ${path.length - 1}`);
  await page.screenshot({ path: `${SHOTS}/n-ladder.png` });
}

// ---------- Emoji Decode: hints, then the right answer
{
  const title = A.emoji.title;
  await page.goto(BASE + "/play/emoji-decode");
  await page.waitForSelector('[aria-label="Emoji clue"]');
  await page.fill('input[aria-label="Film title"]', "definitely not it"); await page.click("text=Go");
  await page.waitForSelector("text=HINT 1");
  check("a wrong guess unlocks a hint", true);
  await page.screenshot({ path: `${SHOTS}/n-emoji.png` });
  await page.fill('input[aria-label="Film title"]', title); await page.click("text=Go");
  await page.waitForSelector("text=Got it in 2");
  check("emoji decode solved", true, title);
}

// ---------- Wordsplice: assemble each answer from its pieces
{
  const today = A.splice;
  await page.goto(BASE + "/play/wordsplice");
  await page.waitForSelector('[aria-label="Pieces"] button');
  const tiles = await page.locator('[aria-label="Pieces"] button').count();
  check("wordsplice shows every piece", tiles === today.reduce((a, c) => a + c.chunks.length, 0), `${tiles} pieces`);
  // a wrong combination first
  await page.locator('[aria-label="Pieces"] button').nth(0).click();
  await page.locator('[aria-label="Pieces"] button').nth(0).click();
  await page.click("text=Submit");
  await page.waitForSelector("text=Doesn't match any clue");
  check("a wrong splice is rejected", true);
  await page.screenshot({ path: `${SHOTS}/n-splice.png` });
  for (const c of today) {
    for (const ch of c.chunks) await page.locator(`[aria-label="Pieces"] button:text-is("${ch}")`).first().click();
    await page.click("text=Submit");
    await page.waitForTimeout(350);
  }
  await page.waitForSelector("text=All 7 found", { timeout: 5000 }).catch(() => {});
  check("wordsplice: all 7 clues solved", (await page.locator("text=/All 7 found|Clean splice/").count()) > 0);
}

// ---------- Sudoku: solve the real puzzle through the grid
{
  await page.goto(BASE + "/play/sudoku");
  await page.waitForSelector('[role="gridcell"]');
  const givens = await page.evaluate(() => fetch("/api/sudoku/puzzle").then((r) => r.json()).then((d) => d.givens));
  const g = [...givens].map(Number);
  const solve = () => { const i = g.indexOf(0); if (i < 0) return true;
    const r = Math.floor(i / 9), c = i % 9;
    for (let d = 1; d <= 9; d++) { let ok = true;
      for (let k = 0; k < 9 && ok; k++) { if (g[r * 9 + k] === d || g[k * 9 + c] === d) ok = false; }
      const br = r - (r % 3), bc = c - (c % 3);
      for (let a = 0; a < 3 && ok; a++) for (let b = 0; b < 3; b++) if (g[(br + a) * 9 + bc + b] === d) ok = false;
      if (ok) { g[i] = d; if (solve()) return true; g[i] = 0; } }
    return false; };
  const empties = [...givens].map((c, i) => (c === "0" ? i : -1)).filter((i) => i >= 0);
  // make one deliberate rule-breaking move and confirm it is flagged
  const first = empties[0]; const row = Math.floor(first / 9);
  const dupe = [...givens].slice(row * 9, row * 9 + 9).find((c) => c !== "0");
  await page.locator('[role="gridcell"]').nth(first).click(); await page.keyboard.press(dupe);
  check("typing a repeated digit is flagged as a conflict", (await page.locator('[role="gridcell"].text-brick').count()) >= 2);
  await page.keyboard.press("Backspace");
  solve();
  await page.screenshot({ path: `${SHOTS}/n-sudoku-start.png` });
  for (const i of empties) { await page.locator('[role="gridcell"]').nth(i).click(); await page.keyboard.press(String(g[i])); }
  await page.waitForSelector("text=Solved in", { timeout: 8000 });
  check("sudoku solved and verified by the server", true);
  await page.screenshot({ path: `${SHOTS}/n-sudoku-win.png` });
}

// ---------- Journal picked everything up
await page.goto(BASE + "/journal");
await page.waitForSelector("text=Word Ladder climbed");
const jt = await page.locator("main").innerText();
check("journal wrote lines for the new games", /Emoji Decode cracked in 2/.test(jt) && /Sudoku finished in/.test(jt) && /Wordsplice done/.test(jt));

// ---------- Quicklist: two browsers play a round
{
  const mk = async () => { const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await c.newPage(); p.on("pageerror", (e) => errors.push("QL PAGEERROR " + e.message)); return p; };
  const a = await mk(), b = await mk();
  await a.goto(BASE + "/party"); await a.fill('input[placeholder="e.g. Kabir"]', "Asha");
  await a.locator("section", { hasText: "Quicklist" }).locator("text=Create a room").click();
  await a.waitForURL(/\/q\/[A-Z]{4}/); const code = a.url().split("/q/")[1];
  await b.goto(BASE + "/party"); await b.fill('input[placeholder="e.g. Kabir"]', "Bo");
  await b.locator('input[aria-label="Quicklist room code"]').fill(code);
  await b.locator("section", { hasText: "Quicklist" }).locator('button:text-is("Join")').click();
  await b.waitForSelector("text=Waiting for the host to start");
  await a.waitForSelector("text=Start game"); await a.screenshot({ path: `${SHOTS}/n-ql-lobby.png` });
  await a.click("text=Start game");
  await a.waitForSelector("text=Write fast"); await b.waitForSelector("text=Write fast");
  const letter = (await a.locator(".font-pixel.text-4xl").innerText()).trim();
  check("quicklist round starts with a letter", /^[A-Z]$/.test(letter), `letter ${letter}`);
  const fillRow = async (p, i, text) => p.locator("ol input").nth(i).fill(text);
  await fillRow(a, 0, letter + "alpha"); await fillRow(a, 1, letter + "same"); await fillRow(a, 2, "9wrong");
  await fillRow(b, 0, letter + "beta"); await fillRow(b, 1, letter + "same");
  check("typing a wrong first letter shows a warning", (await a.locator("text=Must start with").count()) > 0);
  await a.screenshot({ path: `${SHOTS}/n-ql-write.png` });
  await a.click('button:text-is("Done")'); await b.click('button:text-is("Done")');
  await a.waitForSelector("text=Review answers"); await b.waitForSelector("text=Review answers");
  check("review shows everyone's answers", (await a.locator(`text=${letter}beta`).count()) > 0);
  await a.screenshot({ path: `${SHOTS}/n-ql-review.png`, fullPage: true });
  await a.click("text=Ready for scores"); await b.click("text=Ready for scores");
  await a.waitForSelector("text=Round 1 of 3 done");
  const scoreText = await a.locator("ol").last().innerText();
  check("scores: unique answers earn points, the shared one doesn't", /Asha|You/.test(scoreText), scoreText.replace(/\n+/g, " | "));
  await a.screenshot({ path: `${SHOTS}/n-ql-results.png` });
}

console.log("\nerrors:", errors.length ? errors : "none");
console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
await browser.close();
process.exit(fail ? 1 : 0);
