// `npm run lan`: serves the production build to other devices on the same wifi, with the party server alongside.
import { execSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import os from "node:os";

const PORT = process.env.PORT ?? "3000";
const address = Object.values(os.networkInterfaces()).flat().find((n) => n.family === "IPv4" && !n.internal)?.address ?? "localhost";

execSync("npx next build", { stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_PARTYKIT_HOST: "" } });
const env = { ...process.env, ALLOW_HTTP: "1", LETTERBOX_COOKIE_SECRET: process.env.LETTERBOX_COOKIE_SECRET ?? randomBytes(32).toString("base64") };
const children = [
  spawn("npx", ["partykit", "dev", "--port", "1999"], { stdio: "ignore", env }),
  spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", PORT], { stdio: "inherit", env }),
];
console.log(`\nOpen this on any device on the same wifi:  http://${address}:${PORT}\n`);
process.on("SIGINT", () => {
  for (const c of children) c.kill();
  process.exit(0);
});
