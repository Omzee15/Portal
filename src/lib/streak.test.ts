import { describe, expect, it } from "vitest";
import { computeStreak } from "./streak";
import { weekStart } from "./dates";

const set = (...d: string[]) => new Set(d);

describe("computeStreak", () => {
  it("is zero with nothing played", () => {
    expect(computeStreak(set(), "2026-11-04").current).toBe(0);
  });

  it("counts consecutive days, and an unplayed today is not a miss", () => {
    const s = computeStreak(set("2026-11-02", "2026-11-03"), "2026-11-04");
    expect(s.current).toBe(2);
  });

  it("covers one missed day per week with a free freeze", () => {
    // Mon, Tue played; Wed missed (freeze); Thu played; today is Thu
    const s = computeStreak(set("2026-11-02", "2026-11-03", "2026-11-05"), "2026-11-05");
    expect(s.current).toBe(3);
    expect(s.frozen.has("2026-11-04")).toBe(true);
  });

  it("breaks on a second miss in the same week", () => {
    // Mon played, Tue missed (freeze), Wed missed (no freeze left), Thu played
    const s = computeStreak(set("2026-11-02", "2026-11-05"), "2026-11-05");
    expect(s.current).toBe(1);
    expect(s.longest).toBe(1);
  });

  it("earns a fresh freeze each week", () => {
    // miss Sun 8th (week 1 freeze), miss Wed 11th (week 2 freeze)
    const played = set("2026-11-06", "2026-11-07", "2026-11-09", "2026-11-10", "2026-11-12");
    const s = computeStreak(played, "2026-11-12");
    expect(s.current).toBe(5);
    expect(s.frozen.size).toBe(2);
  });

  it("does not burn a freeze before a streak has started", () => {
    const s = computeStreak(set("2026-11-04"), "2026-11-04");
    expect(s.frozen.size).toBe(0);
    expect(s.current).toBe(1);
  });

  it("tracks the longest streak after a break", () => {
    const played = set("2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-11-04");
    const s = computeStreak(played, "2026-11-04");
    expect(s.longest).toBe(4);
    expect(s.current).toBe(1);
  });
});

describe("weekStart", () => {
  it("returns Monday", () => {
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // Sunday
    expect(weekStart("2026-11-02")).toBe("2026-11-02"); // Monday
  });
});
