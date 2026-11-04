import { describe, expect, it } from "vitest";
import raw from "./lists.json";
import dictionary from "an-array-of-english-words";
import { checker } from "./answers";
import { CATEGORIES, LETTERS } from "./engine";

const words = new Set(dictionary as string[]);
const recognise = checker((w) => words.has(w));

describe("recognise", () => {
  it("knows listed answers, ignoring case, spaces and 'the'", () => {
    expect(recognise("A country", "india")).toBe("india");
    expect(recognise("A country", "  NEW zealand ")).toBe("newzealand");
    expect(recognise("A TV show or web series", "The Office")).toBeTruthy();
  });

  it("forgives spelling but not a different word", () => {
    expect(recognise("A fruit or vegetable", "Bananna")).toBe("banana");
    expect(recognise("A country", "Argentinia")).toBe("argentina");
    expect(recognise("An animal", "Elephnat")).toBe("elephant");
    expect(recognise("A fruit or vegetable", "Keyboard")).toBeNull();
    expect(recognise("A country", "Lapan")).toBeNull();
    expect(recognise("An animal", "qwerty")).toBeNull();
  });

  it("treats other names for a thing as the same answer", () => {
    expect(recognise("An Indian city", "Bombay")).toBe(recognise("An Indian city", "Mumbai"));
    expect(recognise("A fruit or vegetable", "Brinjal")).toBe(recognise("A fruit or vegetable", "Aubergine"));
  });

  it("takes part of a person's name", () => {
    expect(recognise("A cricketer or sportsperson", "Kohli")).toBe("viratkohli");
    expect(recognise("A famous person", "Einstein")).toBe("alberteinstein");
  });

  it("doesn't let a real word pass as a near neighbour", () => {
    expect(recognise("An animal", "House")).toBeNull();
    expect(recognise("An animal", "Cart")).toBeNull();
    expect(recognise("A fruit or vegetable", "Pearl")).toBeNull();
    expect(recognise("A colour", "Bed")).toBeNull();
    expect(recognise("A country", "Table")).toBeNull();
  });

  it("takes Hinglish, however it's spelt, as the same answer as the English", () => {
    expect(recognise("An animal", "Kutta")).toBe(recognise("An animal", "Dog"));
    expect(recognise("An animal", "Kuttaa")).toBe(recognise("An animal", "Dog"));
    expect(recognise("A fruit or vegetable", "Aam")).toBe(recognise("A fruit or vegetable", "Mango"));
    expect(recognise("A colour", "Lal")).toBe(recognise("A colour", "Red"));
    expect(recognise("A body part", "Haath")).toBe(recognise("A body part", "Hand"));
    expect(recognise("A dessert or sweet", "Ladoo")).toBe(recognise("A dessert or sweet", "Laddu"));
    expect(recognise("A North Indian dish", "Panir tikka")).toBe("paneertikka");
    expect(recognise("A drink", "Nimbu pani")).toBeTruthy();
  });

  it("knows nothing about blanks or unknown categories", () => {
    expect(recognise("Not a category", "Honey")).toBeNull();
    expect(recognise("A country", "")).toBeNull();
  });

  it("every question has a list, and every list works for most letters", () => {
    expect(Object.keys(raw).sort()).toEqual([...CATEGORIES].sort());
    for (const [category, list] of Object.entries(raw as Record<string, string>)) {
      const firsts = new Set(list.split(/[,/]/).map((e) => e.trim()[0]?.toUpperCase()));
      const missing = LETTERS.filter((l) => !firsts.has(l));
      expect(missing.length, `${category} misses ${missing}`).toBeLessThanOrEqual(7);
    }
  });
});
