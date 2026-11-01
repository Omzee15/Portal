import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("pixel peek hints", async () => {
  const { hintFor } = await import("./images");
  const base = { id: "x", tier: "expert" as const, answers: [], source: "", license: "" };
  const art = { ...base, title: "The Starry Night (Vincent van Gogh)", name: "The Starry Night", artist: "Vincent van Gogh" };
  const photo = { ...base, title: "Mona Lisa", name: "Mona Lisa" };

  it("gives no hint on the first two guesses or after the game is over", () => {
    for (const w of [0, 1, 5, 6]) expect(hintFor(art, w)).toBeUndefined();
  });

  it("escalates for an artwork: artist initial, word count, first letter", () => {
    expect(hintFor(art, 2)).toBe('The artist\'s name starts with "V"');
    expect(hintFor(art, 3)).toBe("The title has 3 words");
    expect(hintFor(art, 4)).toBe('The title starts with "T"');
  });

  it("falls back to the letter count when there is no artist", () => {
    expect(hintFor(photo, 2)).toBe("The answer has 8 letters");
    expect(hintFor(photo, 3)).toBe("The title has 2 words");
  });

  it("ignores a parenthetical in the name and handles one-word titles", () => {
    expect(hintFor({ ...photo, name: "Saturn (planet)" }, 3)).toBe("The title has 1 word");
  });
});
