// Plays Hintline, Letterbox Duel and Doodle Relay through the real UI in separate browsers.
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
  await a.getByLabel("Your guess").waitFor({ timeout: 8000 });
  check("duel: both players racing", await b.getByLabel("Your guess").isVisible());
  await a.getByLabel("Your guess").fill("zzzzz"); await a.getByLabel("Your guess").press("Enter"); await wait(400);
  check("duel: non-word refused", /Not in the word list/.test(await a.textContent("body")));
  await a.getByLabel("Your guess").fill("crane"); await a.getByLabel("Your guess").press("Enter"); await wait(500);
  check("duel: rival doesn't see the letters", !/crane/i.test(await b.textContent("body")));
  await b.screenshot({ path: "e2e/shots/duel.png" });
  for (const w of ["stone", "pilot", "humid", "bumpy", "fudge"]) { await a.getByLabel("Your guess").fill(w); await a.getByLabel("Your guess").press("Enter"); await wait(200); }
  for (const w of ["crane", "stone", "pilot", "humid", "bumpy", "fudge"]) { if (!(await b.getByLabel("Your guess").isVisible())) break; await b.getByLabel("Your guess").fill(w); await b.getByLabel("Your guess").press("Enter"); await wait(200); }
  await a.getByRole("button", { name: "Next round" }).waitFor({ timeout: 6000 });
  check("duel: round ends and shows scores", true);
  await a.getByRole("button", { name: "Next round" }).click(); await wait(500);
  check("duel: round 2 starts", /Round 2 of 5/.test(await a.textContent("body")));
  for (const p of [a, b]) await p.context().close();
}

// ---- Doodle Relay ----
{
  const c = code(), path = `/s/${c}`;
  const ps = [await player("Asha", path), await player("Ben", path), await player("Cy", path), await player("Dee", path)];
  await wait(800);
  await ps[0].getByRole("button", { name: "Start game" }).click();
  await ps[0].getByLabel("Your words").waitFor({ timeout: 8000 });
  for (const [i, p] of ps.entries()) { await p.getByLabel("Your words").fill(`phrase ${i}`); await p.getByRole("button", { name: "Done" }).click(); }
  await wait(700);
  check("doodle: everyone moves on to drawing", await ps[1].getByLabel("Drawing pad").isVisible());
  for (const p of ps) {
    const box = await p.getByLabel("Drawing pad").boundingBox();
    await p.mouse.move(box.x + 40, box.y + 40); await p.mouse.down();
    await p.mouse.move(box.x + 200, box.y + 120, { steps: 8 }); await p.mouse.move(box.x + 100, box.y + 250, { steps: 8 }); await p.mouse.up();
    await p.getByRole("button", { name: "Done" }).click();
  }
  await wait(700);
  await ps[0].screenshot({ path: "e2e/shots/doodle-guess.png" });
  check("doodle: then guessing a drawing", await ps[0].getByRole("img", { name: "Drawing to guess" }).isVisible());
  for (const [i, p] of ps.entries()) { await p.getByLabel("Your words").fill(`guess ${i}`); await p.getByRole("button", { name: "Done" }).click(); }
  await wait(700);
  for (const p of ps) {
    const box = await p.getByLabel("Drawing pad").boundingBox();
    await p.mouse.move(box.x + 60, box.y + 60); await p.mouse.down(); await p.mouse.move(box.x + 150, box.y + 150, { steps: 6 }); await p.mouse.up();
    await p.getByRole("button", { name: "Done" }).click();
  }
  await wait(900);
  const body = await ps[2].textContent("body");
  check("doodle: reveal shows all four chains", /How it went/.test(body) && /phrase 0/.test(body) && /phrase 3/.test(body) && /guess 1/.test(body));
  await ps[2].screenshot({ path: "e2e/shots/doodle-reveal.png", fullPage: true });
  for (const p of ps) await p.context().close();
}
check("no browser errors", errors.length === 0, errors.slice(0, 4).join(" | "));
await browser.close();
console.log(fail ? `${fail} failed` : "all passed");
process.exit(fail ? 1 : 0);
