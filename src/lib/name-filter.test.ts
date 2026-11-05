import { describe, expect, it } from "vitest";
import { cleanName, maskBadWords } from "./name-filter";

describe("cleanName", () => {
  it("keeps ordinary names, including ones that merely contain a bad substring", () => {
    for (const n of ["Neha", "Kabir", "Class Act", "Scunthorpe", "Dr. Who", "Anaïs", "Ravi_99", "Assam Tea"])
      expect(cleanName(n)).toBe(n);
  });

  it("replaces profanity, even with look-alike characters or separators", () => {
    expect(cleanName("shit")).toBe("Player");
    expect(cleanName("SH1T")).toBe("Player");
    expect(cleanName("f.u.c.k")).toBe("Player");
    expect(cleanName("big ass")).toBe("Player");
    expect(cleanName("fuck_off")).toBe("Player");
  });

  it("trims, caps at 16 characters, strips control characters and markup", () => {
    expect(cleanName("   Neha   ")).toBe("Neha");
    expect(cleanName("a".repeat(40))).toHaveLength(16);
    expect(cleanName("Ne\u0000ha")).toBe("Neha");
    expect(cleanName("<b>Neha</b>")).toBe("bNeha/b"); // angle brackets removed; React escapes names on screen anyway
  });

  it("falls back to Player when there is nothing usable", () => {
    for (const n of ["", "   ", null, undefined, "\u0000\u0001"]) expect(cleanName(n as string)).toBe("Player");
  });
});

describe("maskBadWords", () => {
  it("stars out profanity in chat and leaves the rest alone", () => {
    expect(maskBadWords("that was shit lol")).toBe("that was **** lol");
    expect(maskBadWords("SH1T happens")).toBe("**** happens");
    expect(maskBadWords("is it a class or an assam tea?")).toBe("is it a class or an assam tea?");
    expect(maskBadWords("Scunthorpe")).toBe("Scunthorpe");
  });
});
