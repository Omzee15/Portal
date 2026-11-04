// Launches the browser chosen with BROWSER=chromium|firefox|webkit (default chromium).
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const pw = require("playwright");
export const NAME = process.env.BROWSER || "chromium";
export async function launch() {
  const b = await pw[NAME].launch();
  if (NAME === "firefox") {
    // Firefox doesn't support the isMobile option; everything else we use works
    const orig = b.newContext.bind(b);
    b.newContext = (o = {}) => { const rest = { ...o }; delete rest.isMobile; return orig(rest); };
  }
  return b;
}
