import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("pixel peek hints", async () => {
  const { hintFor } = await import("./images");
  const base = { id: "x", tier: "expert" as const, answers: [], source: "", license: "" };
  const art = { ...base, kind: "A famous painting", title: "The Starry Night (Vincent van Gogh)", name: "The Starry Night", artist: "Vincent van Gogh" };
  const thing = { ...base, kind: "An animal", title: "Polar bear", name: "Polar bear" };

  it("gives no hint before the first wrong guess or after the game is over", () => {
    for (const w of [0, 5, 6]) expect(hintFor(thing, w)).toBeUndefined();
  });

  it("says what kind of thing it is first", () => {
    expect(hintFor(thing, 1)).toBe("It's an animal");
    expect(hintFor(art, 1)).toBe("It's a famous painting");
  });

  it("escalates for an artwork: artist initial, title size, first letter", () => {
    expect(hintFor(art, 2)).toBe('The artist\'s name starts with "V"');
    expect(hintFor(art, 3)).toBe("The title is 3 words");
    expect(hintFor(art, 4)).toBe('The title starts with "T"');
  });

  it("escalates for a thing: size, then its opening letters", () => {
    expect(hintFor(thing, 2)).toBe("The answer is 2 words");
    expect(hintFor(thing, 3)).toBe('It starts with "P"');
    expect(hintFor(thing, 4)).toBe('It starts with "PO"');
    expect(hintFor({ ...thing, name: "Saturn (planet)" }, 2)).toBe("The answer is 6 letters");
  });
});
