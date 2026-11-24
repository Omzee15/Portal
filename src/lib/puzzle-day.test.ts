import { describe, expect, it } from "vitest";
import { dailyCacheHeaders, puzzleNumber, secondsUntilNextPuzzle } from "./puzzle-day";
import { cleanPartyHost } from "./party-host";

// 23 Nov 2026, 18:29:00 UTC = 23:59:00 IST
const ONE_MINUTE_BEFORE_IST_MIDNIGHT = Date.UTC(2026, 10, 23, 18, 29, 0);

describe("daily caching", () => {
  it("counts down to 00:00 IST, not UTC midnight", () => {
    expect(secondsUntilNextPuzzle(ONE_MINUTE_BEFORE_IST_MIDNIGHT)).toBe(60);
    expect(secondsUntilNextPuzzle(Date.UTC(2026, 10, 23, 18, 30, 0))).toBe(24 * 3600);
  });

  it("never lets the CDN keep a puzzle past rollover", () => {
    const now = ONE_MINUTE_BEFORE_IST_MIDNIGHT;
    const s = Number(/s-maxage=(\d+)/.exec(dailyCacheHeaders(now)["CDN-Cache-Control"])![1]);
    expect(puzzleNumber(now + s * 1000 - 1)).toBe(puzzleNumber(now));
    expect(puzzleNumber(now + s * 1000)).toBe(puzzleNumber(now) + 1);
  });

  it("skips caching in the last few seconds of the day", () => {
    expect(dailyCacheHeaders(ONE_MINUTE_BEFORE_IST_MIDNIGHT + 57_000)).toEqual({ "Cache-Control": "no-store" });
  });
});

describe("cleanPartyHost", () => {
  it("strips schemes, paths and case", () => {
    expect(cleanPartyHost("https://Portal-Party.me.partykit.dev/")).toBe("portal-party.me.partykit.dev");
    expect(cleanPartyHost("wss://x.partykit.dev/parties/main")).toBe("x.partykit.dev");
    expect(cleanPartyHost("127.0.0.1:1999")).toBe("127.0.0.1:1999");
  });

  it("rejects placeholders and junk", () => {
    for (const v of [undefined, "", "YOUR_PARTYKIT_DEPLOYMENT_ADDRESS", "your-host.partykit.dev", "a b", "x;y"]) expect(cleanPartyHost(v)).toBeUndefined();
  });
});
