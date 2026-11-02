// Builds assets/pixel/common.json from scripts/pixel-common-source.mjs: each thing's lead Wikipedia image, kept only
// if it lives on Commons under a free licence. Author and licence are recorded for the credit line.
// common-skip.json lists images checked by eye and left out as poor puzzles.
import fs from "node:fs";
import { LISTS } from "./pixel-common-source.mjs";

const UA = "PortalApp/0.1 (+https://github.com/nehasultann/Portal)";
const FREE = /^(public domain|pd|cc0|cc[ -]by([ -]sa)?[ -][0-9.]+)/i;
const OUT = "assets/pixel/common.json";
const SKIP = new Set(fs.existsSync("assets/pixel/common-skip.json") ? JSON.parse(fs.readFileSync("assets/pixel/common-skip.json", "utf8")) : []);
const OVERRIDE = fs.existsSync("assets/pixel/common-files.json") ? JSON.parse(fs.readFileSync("assets/pixel/common-files.json", "utf8")) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (host, params) => {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) return await res.json();
    } catch {
      /* connection reset: wait and go again */
    }
    await sleep(3000 * (i + 1));
  }
  throw new Error(`failed ${url}`);
};
const clean = (html) => (html ?? "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim().slice(0, 80);

const items = [];
for (const [tier, kind, list] of LISTS)
  for (const raw of list.split(";")) {
    if (raw.includes("?") || raw.endsWith("@")) continue;
    const [names, page] = raw.split("@");
    const answers = names.split("/");
    const id = answers[0].toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (!SKIP.has(id)) items.push({ id, tier, kind, title: answers[0], answers, page: page ?? answers[0] });
  }

// page -> lead image
for (let i = 0; i < items.length; i += 40) {
  const batch = items.slice(i, i + 40);
  const d = await api("en.wikipedia.org", { action: "query", redirects: "1", prop: "pageimages", piprop: "name", pilimit: "50", titles: batch.map((b) => b.page).join("|") });
  const alias = new Map();
  for (const n of [...(d.query.normalized ?? []), ...(d.query.redirects ?? [])]) alias.set(n.from, n.to);
  const resolve = (t) => { let x = t; while (alias.has(x)) x = alias.get(x); return x; };
  const images = new Map(d.query.pages.map((p) => [p.title, p.pageimage]));
  for (const b of batch) {
    const lead = b.page.startsWith("File:") ? b.page.slice(5) : images.get(resolve(b.page));
    b.file = OVERRIDE[b.id] ?? lead;
  }
  await sleep(400);
}
// file -> licence, from Commons (files held only on Wikipedia are usually fair-use, so they fall out here)
const infoFor = async (files) => {
  const out = new Map();
  for (let i = 0; i < files.length; i += 40) {
    const batch = files.slice(i, i + 40);
    const d = await api("commons.wikimedia.org", { action: "query", redirects: "1", prop: "imageinfo", iiprop: "extmetadata|mime|size", iiextmetadatafilter: "LicenseShortName|Artist", titles: batch.map((f) => `File:${f}`).join("|") });
    const alias = new Map((d.query.normalized ?? []).map((n) => [n.from, n.to]));
    const pages = new Map(d.query.pages.map((p) => [p.title, p]));
    for (const f of batch) {
      const info = pages.get(alias.get(`File:${f}`) ?? `File:${f}`)?.imageinfo?.[0];
      out.set(f, { mime: info?.mime, width: info?.width, license: info?.extmetadata?.LicenseShortName?.value, artist: clean(info?.extmetadata?.Artist?.value) });
    }
    await sleep(300);
  }
  return out;
};
const fits = (b, m) => m?.license && FREE.test(m.license) && (/jpeg|png|webp/.test(m.mime ?? "") || (/flag|logo/.test(b.kind) && /svg/.test(m.mime ?? "")));
// A logo must come from the logo-file list: a company's lead image is usually its head office.
for (const b of items) if (/logo/.test(b.kind) && !OVERRIDE[b.id] && !/\.(svg|png)$/i.test(b.file ?? "")) b.file = undefined;
const leads = await infoFor([...new Set(items.filter((i) => i.file).map((i) => i.file))]);
for (const b of items) if (b.file && fits(b, leads.get(b.file))) Object.assign(b, leads.get(b.file));
  else b.file = undefined;

const keep = items.filter((b) => b.file);
const lost = items.filter((i) => !keep.includes(i)).map((i) => i.id);
fs.writeFileSync(OUT, JSON.stringify(keep.map(({ id, tier, kind, title, answers, file, license, artist }) => ({ id, tier, kind, title, answers, file, license, artist })), null, 0));
const by = (t) => keep.filter((k) => k.tier === t).length;
console.log("kept", keep.length, { medium: by("medium"), hard: by("hard"), expert: by("expert") }, "lost", lost.length);
console.log(lost.join(", "));
