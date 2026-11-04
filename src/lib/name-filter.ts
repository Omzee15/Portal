import { array as BADWORDS } from "badwords-list";

const BAD = new Set(BADWORDS.map((w) => w.toLowerCase()).filter((w) => w.length > 2));

// Common look-alike substitutions, so "sh1t" and "@ss" are caught.
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };
const deLeet = (s: string) => s.replace(/[01345 7@$!]/g, (c) => LEET[c] ?? c);

/**
 * A display name safe to show other players: trimmed, no control characters, at most 16 characters, and replaced
 * with "Player" if any word in it is a known slur or profanity. Whole words only, so names like "Class" are fine.
 */
export function cleanName(raw: string | null | undefined): string {
  const name = (raw ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
  if (!name) return "Player";
  const tokens = deLeet(name.toLowerCase()).split(/[^a-z]+/).filter(Boolean);
  const squashed = deLeet(name.toLowerCase()).replace(/[^a-z]/g, "");
  if (tokens.some((t) => BAD.has(t)) || BAD.has(squashed)) return "Player";
  return name;
}
