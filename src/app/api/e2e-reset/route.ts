import { connection } from "next/server";
import { istDateString, puzzleNumber } from "@/lib/puzzle-day";

const COOKIES = ["lb_attempt", "lb_bundle", "lb_pixel2", "lb_emoji", "lb_odd"];

/**
 * TEST ONLY. Open it in a browser to replay today's dailies: clears that browser's attempts for today, keeps
 * everything else. It is disabled (404) unless the server was started with PORTAL_E2E=1, which must never be set in production.
 */
export async function GET() {
  await connection(); // read the env at request time; otherwise the 404 is frozen into the build
  if (process.env.PORTAL_E2E !== "1") return new Response("Not found", { status: 404 });
  const script = `
    for (const k of Object.keys(localStorage)) if (/^portal:[a-z0-9]+:${puzzleNumber()}$/.test(k)) localStorage.removeItem(k);
    const results = JSON.parse(localStorage.getItem("portal:v1:results") || "{}");
    const today = results["${istDateString()}"] || {};
    for (const game of Object.keys(today)) if (game !== "fuse" && game !== "quicklist") delete today[game];
    localStorage.setItem("portal:v1:results", JSON.stringify(results));
    location.replace("/");`;
  const headers = new Headers({ "Content-Type": "text/html", "Cache-Control": "no-store" });
  for (const c of COOKIES) headers.append("Set-Cookie", `${c}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return new Response(`<!doctype html><title>Resetting</title><script>${script}</script>`, { headers });
}
