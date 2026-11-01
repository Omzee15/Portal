import words from "an-array-of-english-words";

const LIST = (words as string[]).filter((w) => /^[a-z]{3,20}$/.test(w));
const SET = new Set(LIST);

export const isWord = (w: string) => SET.has(w);

// Chunks for the fuse: common enough that every turn is fair (hundreds of valid words each).
const counts = new Map<string, number>();
for (const w of LIST) {
  if (w.length < 4 || w.length > 10) continue;
  const seen = new Set<string>();
  for (const n of [2, 3]) {
    for (let i = 0; i + n <= w.length; i++) seen.add(w.slice(i, i + n));
  }
  for (const c of seen) counts.set(c, (counts.get(c) ?? 0) + 1);
}
const CHUNKS = [...counts].filter(([, n]) => n >= 300 && n <= 12000).map(([c]) => c);

export const pickChunk = () => CHUNKS[Math.floor(Math.random() * CHUNKS.length)];
export const chunkCount = CHUNKS.length;
