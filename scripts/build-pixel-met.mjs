// Builds assets/pixel/met.json from the Met Museum's open-access API (CC0).
// Keeps only objects the Met marks as public domain and that have an image.
// Usage: node scripts/build-pixel-met.mjs
import fs from "node:fs";

const API = "https://collectionapi.metmuseum.org/public/collection/v1";
const UA = { "User-Agent": "PortalApp/0.1 (+https://github.com/nehasultann/Portal)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
    } catch {
      /* retry */
    }
    await sleep(500 * (i + 1));
  }
  return null;
}

const ids = [];
for (let offset = 0; ; offset += 500) {
  const page = await getJson(`${API}/../v1.1/search?isHighlight=true&hasImages=true&q=*&limit=500&offset=${offset}`);
  if (!page?.objectIDs?.length) break;
  ids.push(...page.objectIDs);
  if (ids.length >= page.total) break;
}
console.log("highlight ids:", ids.length);

const out = [];
let done = 0;
async function worker(queue) {
  while (queue.length) {
    const id = queue.pop();
    const d = await getJson(`${API}/objects/${id}`);
    done++;
    if (done % 200 === 0) console.log(`  ${done}/${ids.length}`);
    if (!d || !d.isPublicDomain || !d.primaryImageSmall || !d.title) continue;
    out.push({
      id: d.objectID,
      title: d.title,
      artist: d.artistDisplayName || "",
      date: d.objectDate || "",
      dept: d.department || "",
      culture: d.culture || "",
      image: d.primaryImageSmall,
      url: d.objectURL,
    });
    await sleep(40); // stay well under the Met's 80 requests/second limit
  }
}
const queue = [...ids];
await Promise.all(Array.from({ length: 6 }, () => worker(queue)));
out.sort((a, b) => a.id - b.id);
fs.writeFileSync("assets/pixel/met.json", JSON.stringify(out));
console.log("kept", out.length, "public-domain artworks with images");
