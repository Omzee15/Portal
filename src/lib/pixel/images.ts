import "server-only";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { pickFromPool, tierSlot, type Tier } from "../schedule";

export type { Tier };
export type Picture = {
  id: string;
  tier: Tier;
  /** shown once the game is over */
  title: string;
  /** names a guess may match: title, artist, artist surname */
  answers: string[];
  source: string;
  license: string;
  /** local file under assets/pixel, or a Wikimedia Commons file name */
  local?: string;
  commons?: string;
};

export const MAX_GUESSES = 5;
const SIZE = 440;
const DIR = path.join(process.cwd(), "assets", "pixel");
const UA = "PortalApp/0.1 (+https://github.com/nehasultann/Portal)";

// Blur strength (sigma, on a 440px picture) at each of the 5 guesses; 0 = sharp. Harder tiers start
// blurrier, and expert pictures also start in greyscale.
const BLUR: Record<Tier, number[]> = {
  medium: [34, 22, 13, 6, 0],
  hard: [38, 26, 16, 8, 0],
  expert: [44, 30, 18, 9, 0],
};
const GREY_BELOW: Record<Tier, number> = { medium: 0, hard: 0, expert: 2 };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(the|a|an) /, "");

// ---- the pool -------------------------------------------------------------------------------
// 1) A handful of photos kept on disk (assets/pixel/puzzles.json).
type LocalRow = { id: string; file: string; tier: string; title: string; answers: string[]; source: string; license: string };
const localRows: LocalRow[] = JSON.parse(fs.readFileSync(path.join(DIR, "puzzles.json"), "utf8"));
const LOCAL: Picture[] = localRows.map((r) => ({
  id: `local:${r.id}`,
  tier: (r.tier === "hard" ? "hard" : "medium") as Tier, // there is no easy tier any more
  title: r.title,
  answers: r.answers,
  source: r.source,
  license: r.license,
  local: r.file,
}));

// 2) Famous public-domain artworks from Wikidata/Commons (scripts/build-pixel-art.mjs), if that file exists.
type ArtRow = { id: string; title: string; artist: string; file: string; sitelinks: number };
let artRows: ArtRow[] = [];
try {
  artRows = JSON.parse(fs.readFileSync(path.join(DIR, "art.json"), "utf8"));
} catch {
  /* optional: the game runs on the local photos alone */
}
const surname = (a: string) => a.split(" ").slice(-1)[0];
const ART: Picture[] = artRows.map((a) => ({
  id: `art:${a.id}`,
  // the more Wikipedia languages cover a work, the more recognisable it is
  tier: (a.sitelinks >= 40 ? "medium" : a.sitelinks >= 20 ? "hard" : "expert") as Tier,
  title: `${a.title} (${a.artist})`,
  answers: [a.title, a.title.split(/[,:(]/)[0], a.artist, ...(surname(a.artist).length >= 4 ? [surname(a.artist)] : [])],
  source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(a.file.replace(/ /g, "_"))}`,
  license: "Public domain",
  commons: a.file,
}));

const POOLS: Record<Tier, Picture[]> = { medium: [], hard: [], expert: [] };
for (const p of [...LOCAL, ...ART]) POOLS[p.tier].push(p);
// Stable order so every server walks the pools identically.
for (const t of Object.keys(POOLS) as Tier[]) POOLS[t].sort((a, b) => a.id.localeCompare(b.id));

export const poolSizes = () => ({ medium: POOLS.medium.length, hard: POOLS.hard.length, expert: POOLS.expert.length });

export function pictureForPuzzle(number: number): Picture {
  const { tier, k } = tierSlot(number);
  const pool = POOLS[tier].length ? POOLS[tier] : [...POOLS.medium, ...POOLS.hard];
  return pickFromPool(pool, k, 47);
}

// ---- image bytes ----------------------------------------------------------------------------
const bytes = new Map<string, Buffer>();
async function loadBytes(pic: Picture): Promise<Buffer> {
  const hit = bytes.get(pic.id);
  if (hit) return hit;
  let buf: Buffer;
  if (pic.local) buf = fs.readFileSync(path.join(DIR, pic.local));
  else {
    const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(pic.commons!)}?width=900`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  }
  bytes.set(pic.id, buf);
  if (bytes.size > 6) bytes.delete(bytes.keys().next().value as string);
  return buf;
}

const rendered = new Map<string, string>();

/** The picture at a guess level, as a data URL. The sharp original never leaves the server. */
export async function renderLevel(pic: Picture, level: number): Promise<string> {
  const lv = Math.min(level, MAX_GUESSES - 1);
  const key = `${pic.id}:${lv}`;
  const hit = rendered.get(key);
  if (hit) return hit;
  const sigma = BLUR[pic.tier][lv];
  let img = sharp(await loadBytes(pic)).resize(SIZE, SIZE, { fit: "cover", position: sharp.strategy.attention });
  if (lv < GREY_BELOW[pic.tier]) img = img.grayscale();
  if (sigma > 0) img = img.blur(sigma);
  const out = await img.jpeg({ quality: sigma > 0 ? 60 : 82 }).toBuffer();
  const url = `data:image/jpeg;base64,${out.toString("base64")}`;
  rendered.set(key, url);
  if (rendered.size > 40) rendered.delete(rendered.keys().next().value as string);
  return url;
}

/** A tiny pixelated copy of the picture: the journal sticker for a solved day. */
export async function stickerFor(pic: Picture): Promise<string> {
  const buf = await sharp(await loadBytes(pic)).resize(28, 28, { fit: "cover", position: sharp.strategy.attention }).png().toBuffer();
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Exact match on any accepted name, or one typo on names of 7+ letters ("starry nite"). */
export function isCorrect(pic: Picture, guess: string): boolean {
  const g = norm(guess);
  if (!g) return false;
  return pic.answers.some((a) => {
    const n = norm(a);
    return n === g || (n.length >= 7 && g.length >= 7 && lev(n, g) <= 1);
  });
}
