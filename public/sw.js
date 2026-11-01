/* Portal service worker: offline shell + resume.
 * - Static assets: cache-first (they are content-hashed).
 * - Pages: network-first, falling back to the last cached copy.
 * - API calls are never cached: answers and guesses always come from the server,
 *   except the public word list, which is stale-while-revalidate. */
const VERSION = "v4";
const SHELL = `pastime-shell-${VERSION}`;
const PAGES = `pastime-pages-${VERSION}`;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/", "/offline.html"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Clone synchronously: the body is consumed as soon as the response is handed to the page. */
function stash(e, cacheName, req, res) {
  if (!res || !res.ok) return res;
  const copy = res.clone();
  e.waitUntil(caches.open(cacheName).then((c) => c.put(req, copy)));
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname === "/api/letterbox/words") {
    e.respondWith(
      caches.open(PAGES).then(async (c) => {
        const hit = await c.match(req);
        const fresh = fetch(req).then((r) => stash(e, PAGES, req, r)).catch(() => hit);
        return hit || fresh;
      }),
    );
    return;
  }
  if (url.pathname.startsWith("/api/")) return;

  // Room pages are live; never serve a stale one.
  if (url.pathname.startsWith("/r/") || url.pathname.startsWith("/q/")) return;

  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => stash(e, SHELL, req, r))));
    return;
  }

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => stash(e, PAGES, req, r))
        .catch(async () => (await caches.match(req)) || (await caches.match("/")) || caches.match("/offline.html")),
    );
  }
});
