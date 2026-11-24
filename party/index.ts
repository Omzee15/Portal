import { routePartykitRequest } from "partyserver";
import { checkOrigin } from "./origin";
import type { Env } from "./env";
import { doodle } from "../src/lib/doodle/engine";
import { hintline } from "../src/lib/hintline/engine";
import { makeDuel } from "../src/lib/duel/engine";
import { isWord } from "./dictionary";
import { roomServer } from "./room";

// Each export is a Durable Object class; wrangler.jsonc binds it as Main / Quicklist / Hintline / Duel / Doodle,
// which clients reach at /parties/main, /parties/quicklist, ... (the binding name in kebab-case).
export { FuseRoom as Main } from "./fuse";
export { QuicklistRoom as Quicklist } from "./quicklist";
export class Hintline extends roomServer(hintline) {}
export class Duel extends roomServer(makeDuel(isWord)) {}
export class Doodle extends roomServer(doodle) {}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env, { onBeforeConnect: (req) => checkOrigin(req, env) })) ||
      new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
