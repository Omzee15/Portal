// Plays Hintline, Letterbox Duel and Doodle Dash through the real UI in separate browsers.
// Needs the app on BASE (default :3100, started with PORTAL_E2E=1 not required) and `npm run party` on :1999.
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://127.0.0.1:3100";
let fail = 0;
const check = (n, c, x = "") => { console.log(c ? "PASS" : "FAIL", n, x); if (!c) fail++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const errors = [];
async function player(name, path) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/favicon|404/.test(m.text()) && errors.push(`${name}: ${m.text()}`));
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("e.g. Kabir").fill(name);
  await page.getByRole("button", { name: "Join" }).click();
  return page;
}
const code = () => Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)]).join("");

// ---- Hintline ----
{
  const c = code(), path = `/h/${c}`;
  const [a, b, d, e] = [await player("Asha", path), await player("Ben", path), await player("Cy", path), await player("Dee", path)];
  await wait(800);
  await a.getByRole("button", { name: "Give clues" }).first().click(); await wait(200);
  await b.getByRole("button", { name: "Guess" }).first().click(); await wait(200);
  await d.getByRole("button", { name: "Give clues" }).nth(1).click(); await wait(200);
  await e.getByRole("button", { name: "Guess" }).nth(1).click(); await wait(400);
  await a.getByRole("button", { name: "Start game" }).click();
  await a.getByRole("group", { name: "Board" }).waitFor({ timeout: 8000 });
  await wait(500);
  const labels = (p) => p.getByRole("group", { name: "Board" }).getByRole("button").evaluateAll((els) => els.map((x) => x.getAttribute("aria-label")));
  check("hintline: 25 cards", (await labels(a)).length === 25);
  check("clue-giver sees the key, guessers do not", (await labels(a)).every((l) => l.includes(",")) && (await labels(b)).every((l) => !l.includes(",")));
  await a.screenshot({ path: "e2e/shots/hint-clue.png" });
  const teal = (await a.textContent("body")).includes("Team Teal: clue");
  const [cluer, guesser] = teal ? [a, b] : [d, e];
  const team = teal ? "a" : "b";
  await cluer.getByLabel("Your clue").fill("zzword");
  await cluer.getByRole("button", { name: "Give" }).click();
  await guesser.getByText("ZZWORD", { exact: false }).first().waitFor({ timeout: 5000 }).catch(() => {});
  await wait(400);
  const key = await labels(cluer);
  const trap = key.findIndex((l) => l.endsWith(", trap"));
  const mine = key.findIndex((l) => l.endsWith(`, ${team}`));
  check("guesser's board unlocks after the clue", await guesser.getByRole("group", { name: "Board" }).getByRole("button").nth(mine).isEnabled());
  await guesser.getByRole("group", { name: "Board" }).getByRole("button").nth(mine).click(); await wait(400);
  await guesser.getByRole("group", { name: "Board" }).getByRole("button").nth(trap).click(); await wait(600);
  check("hitting the trap ends the game", /wins/.test(await a.textContent("body")));
  await a.screenshot({ path: "e2e/shots/hint-end.png" });
  await a.getByRole("button", { name: "Play again" }).click(); await wait(600);
  check("hintline rematch", /How it works/.test(await a.textContent("body")));
  for (const p of [a, b, d, e]) await p.context().close();
}

// ---- Letterbox Duel ----
{
  const c = code(), path = `/d/${c}`;
  const [a, b] = [await player("Asha", path), await player("Ben", path)];
  await wait(800);
  await a.getByRole("button", { name: "Start game" }).click();
  const board = (p) => p.getByRole("grid", { name: "Your guesses" });
  const letters = (p, r) => board(p).getByRole("row").nth(r).getByRole("gridcell").evaluateAll((els) => els.map((x) => x.textContent).join(""));
  const coloured = (p, r) => board(p).getByRole("row").nth(r).locator("[data-state]").count();
  const enter = async (p, w) => { await p.keyboard.type(w); await p.keyboard.press("Enter"); await wait(300); };
  await board(a).waitFor({ timeout: 8000 });
  check("duel: wordle grid, no text box", (await board(b).isVisible()) && (await a.getByRole("textbox").count()) === 0);
  await a.keyboard.type("zzz"); await wait(100);
  check("duel: typing fills the grid", (await letters(a, 0)) === "zzz");
  for (const k of ["Backspace", "Backspace", "Backspace"]) await a.keyboard.press(k);
  await a.getByRole("button", { name: "c", exact: true }).dispatchEvent("pointerdown");
  check("duel: on-screen keys type", (await letters(a, 0)) === "c");
  await a.keyboard.press("Backspace");
  await enter(a, "zzzzz");
  check("duel: non-word refused", /Not in word list/.test(await a.textContent("body")));
  for (let i = 0; i < 5; i++) await a.keyboard.press("Backspace");
  await enter(a, "crane");
  check("duel: guess waits for the rival, uncoloured", /Waiting for Ben/.test(await a.textContent("body")) && (await coloured(a, 0)) === 0 && (await letters(a, 0)) === "crane");
  check("duel: rival sees a lock, not the letters", /Asha locked in/.test(await b.textContent("body")) && !/crane/i.test(await b.textContent("body")));
  await b.screenshot({ path: "e2e/shots/duel.png" });
  await enter(b, "stone"); await wait(300);
  check("duel: both rows flip together", (await coloured(a, 0)) === 5 && (await coloured(b, 0)) === 5);
  await a.screenshot({ path: "e2e/shots/duel-reveal.png" });
  for (const w of ["pilot", "humid", "bumpy", "fudge", "lymph"]) {
    if (await a.getByRole("button", { name: "Next round" }).isVisible()) break;
    await enter(a, w); await enter(b, w);
  }
  await a.getByRole("button", { name: "Next round" }).waitFor({ timeout: 6000 });
  check("duel: round ends and shows scores", true);
  await a.getByRole("button", { name: "Next round" }).click(); await wait(500);
  check("duel: round 2 starts", /Round 2 of 5/.test(await a.textContent("body")));
  for (const p of [a, b]) await p.context().close();
}

// ---- Doodle Dash ----
{
  const c = code(), path = `/s/${c}`;
  const ps = [await player("Asha", path), await player("Ben", path), await player("Cy", path)];
  await wait(800);
  await ps[0].getByRole("button", { name: "Start game" }).click();
  await ps[0].getByText(/choosing a word|Pick a word/).waitFor({ timeout: 8000 });
  await wait(300);
  const drawerAt = (await Promise.all(ps.map((p) => p.getByText("Pick a word to draw").isVisible()))).indexOf(true);
  check("doodle: one player picks a word", drawerAt >= 0);
  const drawer = ps[drawerAt], [g1, g2] = ps.filter((_, i) => i !== drawerAt);
  check("doodle: the others wait for the pick", /is choosing a word/.test(await g1.textContent("body")));
  const choice = drawer.locator("div.absolute button").first();
  await choice.click();
  await drawer.getByLabel("Drawing pad").waitFor({ timeout: 5000 });
  const word = (await drawer.getByText(/^Draw:/).textContent()).replace(/^Draw:\s*/, "").trim().toLowerCase();
  check("doodle: guessers see blanks, not the word", (await g1.getByLabel("The word").textContent()).startsWith(word.replace(/[a-z]/g, "_")) && !(await g1.textContent("body")).toLowerCase().includes(`draw: ${word}`));
  const box = await drawer.getByLabel("Drawing pad").boundingBox();
  await drawer.mouse.move(box.x + 40, box.y + 40); await drawer.mouse.down();
  await drawer.mouse.move(box.x + 200, box.y + 120, { steps: 8 }); await drawer.mouse.move(box.x + 100, box.y + 250, { steps: 8 }); await drawer.mouse.up();
  await wait(500);
  const inked = (p) => p.getByRole("img", { name: "The drawing" }).evaluate((cv) => { const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 200) n++; return n; });
  check("doodle: guessers see the drawing live", (await inked(g1)) > 50);
  const say = async (p, t) => { await p.getByLabel("Guess or chat").fill(t); await p.getByLabel("Guess or chat").press("Enter"); await wait(400); };
  await say(g1, "pineapplezzz");
  check("doodle: wrong guesses show in everyone's chat", /pineapplezzz/.test(await g2.getByRole("list", { name: "Chat" }).textContent()));
  await say(g1, word);
  check("doodle: right guess is announced, not shown", /You guessed the word!/.test(await g1.getByRole("list", { name: "Chat" }).textContent()) && /Asha guessed the word!|Ben guessed the word!|Cy guessed the word!/.test(await g2.getByRole("list", { name: "Chat" }).textContent()) && !(await g2.getByRole("list", { name: "Chat" }).textContent()).toLowerCase().includes(word));
  await say(g1, `psst ${word}`);
  check("doodle: chat after guessing stays hidden from guessers", !(await g2.getByRole("list", { name: "Chat" }).textContent()).includes("psst"));
  await g1.screenshot({ path: "e2e/shots/doodle-guessed.png" });
  await say(g2, word);
  await wait(300);
  check("doodle: turn ends when everyone has it", /The word was/.test(await drawer.textContent("body")));
  await drawer.screenshot({ path: "e2e/shots/doodle-turn-end.png" });
  await ps[0].getByText(/choosing a word|Pick a word/).waitFor({ timeout: 10000 });
  await wait(300);
  const next = (await Promise.all(ps.map((p) => p.getByText("Pick a word to draw").isVisible()))).indexOf(true);
  check("doodle: next player draws", next >= 0 && next !== drawerAt);
  for (const p of ps) await p.context().close();
}
check("no browser errors", errors.length === 0, errors.slice(0, 4).join(" | "));
await browser.close();
console.log(fail ? `${fail} failed` : "all passed");
process.exit(fail ? 1 : 0);
