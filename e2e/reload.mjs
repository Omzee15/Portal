// Reload-mid-game checks for every daily. Needs the web server on :3100.
import { launch } from "./browser.mjs";
const BASE = "http://localhost:3100";
import { answers as getAnswers } from "./today.mjs";
const A = await getAnswers();
const G = A.bundle.map((g) => g.words);
const b = await launch();
const out = (n, ok, x = "") => console.log(ok ? "ok    " : "BUG   ", n, x);
const newPage = async () => (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();

// Letterbox: 2 wrong-ish guesses then reload: rows + keyboard colours restored, can keep playing
{
  const p = await newPage();
  // Wait for the page to finish loading: keys pressed before then are dropped.
  await p.goto(BASE + "/play/letterbox", { waitUntil: "networkidle" }); await p.waitForSelector('[role="grid"]');
  const type = async (w) => { for (const c of w) await p.keyboard.press(c); await p.keyboard.press("Enter"); await p.waitForTimeout(900); };
  await type("crane"); await type("stone");
  await p.reload({ waitUntil: "networkidle" }); await p.waitForSelector('[role="grid"]');
  const filled = await p.locator('[role="gridcell"][data-state]').count();
  const kb = await p.locator('.key[data-state]').count();
  out("Letterbox reload keeps 2 coloured rows + keyboard colours", filled === 10 && kb > 0, `tiles=${filled} coloured keys=${kb}`);
  await type("plant");
  const after = await p.locator('[role="gridcell"][data-state]').count();
  out("Letterbox can continue after reload (3rd guess counted)", after === 15, `tiles=${after}`);
}
// Bundle: solve one group, make a mistake, reload
{
  const p = await newPage();
  await p.goto(BASE + "/play/bundle"); await p.waitForSelector('[role="group"] button');
  const tap = (w) => p.locator(`[role="group"] button:text-is("${w}")`).click();
  for (const w of G[0]) await tap(w);
  await p.click("text=Submit"); await p.waitForTimeout(500);
  for (const w of [G[1][0], G[2][0], G[3][0], G[1][1]]) await tap(w);
  await p.click("text=Submit"); await p.waitForTimeout(500);
  await p.reload(); await p.waitForSelector("text=Mistakes left");
  const found = await p.getByText(A.bundle[0].title, { exact: true }).count();
  const dots = await p.locator("span.bg-brick").count();
  out("Bundle reload keeps found group + mistakes", found > 0 && dots === 3, `fruits row=${found} remaining-dots=${dots}`);
  // the guessed-wrong combo must still be refused as a repeat
  for (const w of [G[1][0], G[2][0], G[3][0], G[1][1]]) await tap(w);
  await p.click("text=Submit");
  out("Bundle remembers a repeated wrong guess after reload", (await p.locator("text=Already guessed").count()) > 0);
}
// Pixel Peek: one wrong guess then reload
{
  const p = await newPage();
  await p.goto(BASE + "/play/pixel-peek"); await p.waitForSelector('input[placeholder="What is it?"]');
  await p.fill('input[placeholder="What is it?"]', "banana"); await p.click("text=Go"); await p.waitForSelector("text=Not quite");
  const cells = (await p.locator("img.img-in").getAttribute("src")).length;
  await p.reload(); await p.waitForSelector('input[placeholder="What is it?"]');
  const cells2 = (await p.locator("img.img-in").getAttribute("src")).length;
  out("Pixel Peek reload keeps the sharpened picture + wrong guess", cells2 === cells && (await p.locator("text=banana").count()) > 0, `${cells} -> ${cells2} chars`);
}
// Odd One: reload keeps the clock running (not reset to a fresh minute)
{
  const p = await newPage();
  await p.goto(BASE + "/play/odd-one"); await p.waitForSelector("text=Which one doesn't belong?");
  await p.waitForTimeout(4500);
  await p.reload(); await p.waitForTimeout(700);
  const t = await p.locator(".font-pixel.text-lg").innerText();
  const secs = parseInt(t);
  out("Odd One clock continues across a reload (not reset to 90)", secs < 88 && secs > 70, `shows ${t}`);
}
await b.close();
