import type * as Party from "partykit/server";

/**
 * Runs before every WebSocket handshake. Browsers always send an Origin header on a WebSocket, and a page can't
 * forge it, so checking it stops some other website from opening sockets into our rooms with its visitors' browsers.
 *
 * ALLOWED_ORIGINS (comma separated, set in partykit.json "vars" or with `partykit deploy --var`) lists the site(s).
 * Pages on this machine or the home network are always allowed so `npm run dev` and `npm run lan` keep working.
 * A request with no Origin is not from a browser (tests, scripts); those can set any header anyway, so the room
 * engines' own checks are what protect against them.
 */
export function checkOrigin(req: Party.Request, lobby: Party.Lobby): Party.Request | Response {
  const origin = req.headers.get("origin");
  if (!origin) return req;
  const allowed = String(lobby.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  if (allowed.length === 0 || allowed.includes(origin)) return req;
  let host = "";
  try {
    host = new URL(origin).hostname;
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  if (/^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.endsWith(".local")) return req;
  return new Response("Forbidden", { status: 403 });
}
