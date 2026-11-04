import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("service worker", () => {
  it("never serves a cached page for a live room", () => {
    const worker = readFileSync("public/sw.js", "utf8");
    const exempt = new RegExp(worker.match(/if \(\/(.+)\/\.test\(url\.pathname\)\) return;/)![1]);
    const rooms = readdirSync("src/app", { withFileTypes: true })
      .filter((d) => d.isDirectory() && readdirSync(`src/app/${d.name}`).includes("[code]"))
      .map((d) => `/${d.name}/ABCD`);
    expect(rooms.length).toBeGreaterThanOrEqual(5);
    for (const room of rooms) expect(room, room).toMatch(exempt);
  });
});
