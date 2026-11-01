// Accessibility scan (axe-core, WCAG 2 A/AA) on the main screens. Needs the web server on :3101 (or BASE).
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const BASE = process.env.BASE || "http://localhost:3101";
const pages = ["/", "/play/letterbox", "/play/bundle", "/play/pixel-peek", "/play/odd-one", "/play/word-ladder", "/play/emoji-decode", "/play/sudoku", "/play/wordsplice", "/journal", "/party"];
const b = await chromium.launch();
let total = 0;
for (const mobile of [true, false]) {
  const ctx = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile });
  for (const path of pages) {
    const p = await ctx.newPage();
    await p.goto(BASE + path, { waitUntil: "networkidle" }); await p.waitForTimeout(500);
    const r = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const v = r.violations;
    total += v.length;
    console.log(`${mobile ? "phone  " : "desktop"} ${path.padEnd(20)} ${v.length ? v.length + " issue(s)" : "clean"}`);
    for (const x of v) console.log(`   [${x.impact}] ${x.id}: ${x.help} (${x.nodes.length} element${x.nodes.length > 1 ? "s" : ""}) e.g. ${x.nodes[0].target.join(" ")}`);
    await p.close();
  }
  await ctx.close();
}
console.log(total ? `\n${total} accessibility issue types found` : "\nNo accessibility violations found");
await b.close();
process.exit(total ? 1 : 0);
