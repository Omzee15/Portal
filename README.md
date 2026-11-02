# Portal

Your portal for all games: daily games, played with your people, and a journal that writes itself. For friends and daily journalers.
See the project plan for the full vision; this README covers running what exists.

## Free, by design

Everything in Portal is free: no paid tier, paywalled feature, ads or payments code, and streak freezes
are automatic. Dependencies are open source and the fonts are open licence. The hosting targets
(Vercel, Supabase, PartyKit/Cloudflare) all have free tiers, but limits change, so check them before launch
and don't create a paid project without a deliberate decision.

## Run it

```bash
cp .env.example .env.local      # then set LETTERBOX_COOKIE_SECRET (openssl rand -base64 32)
npm install
npm run dev                     # web app on :3000
npm run party                   # Fuse party server on :1999 (separate terminal)
npm test                        # unit tests (scoring, streaks, IST rollover, Fuse engine)
```

Browser tests: `npm run build && npm start -- -p 3100` and `npm run party`, then `npm run e2e:all`
(smoke flow, every new game, regressions for fixed bugs, reload-mid-game checks, and the party-room checks).
Pictures are public domain from Wikimedia Commons; each entry records its source and licence.
The browser tests need today's answers, so start the server with `PORTAL_E2E=1` (it enables `/api/e2e-answers`,
which is a 404 otherwise: never set it in production).

## What's built

| Area | Status |
|---|---|
| Core dailies: Letterbox, Bundle, Pixel Peek | Playable, answers checked on the server |
| More dailies: Odd One, Word Ladder, Emoji Decode, Sudoku, Wordsplice | Playable |
| Party games: Fuse, Quicklist | Live for 2–12 players via PartyKit. Server-owned timers, reconnect, host handoff, rematch |
| Journal, streaks + weekly freeze, stats, notes, stickers | Local to the device |
| PWA (installable, offline shell + resume) | Production builds only |
| Website | Same app, responsive: top nav, two-column Today, share-preview images |

## Puzzle pools (no repeats, medium difficulty and up)

Every daily is at least **medium**: Mon/Tue medium, Wed/Thu/Sat hard, Fri/Sun expert. Each tier has its own pool,
walked through a fixed shuffle (`src/lib/schedule.ts`), so a puzzle never comes back until that tier's pool is used up.
Tests walk whole pools and fail on any repeat.

| Game | Pool | How it's made |
|---|---|---|
| Letterbox | 2,632 answers (849 / 1,117 / 666) | Common 5-letter words, tiered by word frequency, plurals and profanity removed (`scripts/build-letterbox.mjs`) |
| Word Ladder | 9,000 pairs sampled from ~190,000 | Exact shortest paths over everyday words: 5 steps medium, 6 hard, 7+ expert (`scripts/build-ladder.mjs`) |
| Bundle | Effectively unlimited (3,000 days checked) | Generated from 226 categories, including double-meaning and hidden-word groups. Each board must contain words that fit two groups and still have exactly one solution (`scripts/build-categories.mjs`) |
| Odd One | Same generator | All five words usually share a category; the odd one is found by a hidden property, and rivals are rejected so one answer stands |
| Wordsplice | ~4,500 longer words with short WordNet clues | `scripts/build-splice.mjs`; 7 words a day, 2-4 letter pieces, 4-10 decoy pieces by tier |
| Sudoku | Unlimited | Seeded generator, unique solution guaranteed; 34 / 29 / 25 clues |
| Pixel Peek | Photos of things people can name, people, logos, flags and world-famous paintings (680+) | `scripts/build-pixel-common.mjs`: hand-picked list + lead images from Wikipedia/Commons, free licences only, author credited after each game |
| Emoji Decode | 440+, hand-written | Famous people, countries, cities, food, animals, jobs, sports, brands, festivals, places, phrases and well-known films (`scripts/build-emoji.mjs`). Only things most people would recognise |

The category data for Bundle/Odd One is in `scripts/categories-source.mjs`; completion groups ("___ball") are checked
against a dictionary at build time so only real compounds survive. Rebuild any pool with its script in `scripts/`.

## Party games

Fuse, Quicklist, Hintline, Letterbox Duel and Doodle Relay. Game rules live in pure engines under `src/lib/`; the newer
three share `party/room.ts` (sockets, saving, restoring, timers) and `src/components/party/RoomFrame.tsx` (name prompt,
reconnecting, share code), so a new room needs only an engine, a screen and a line in `partykit.json`.

## Playing over home wifi

`npm run lan` builds the app, starts it with the party server, and prints the address for other devices. They must be
on the same wifi, and the firewall must allow ports 3000 and 1999 (`sudo ufw allow 3000,1999/tcp` on Ubuntu).

## Going live

**Ready for a closed beta with friends.** A public launch needs the items under "Needed for a public launch".

Deploy checklist:
1. **Web app:** deploy to Vercel (free tier). Set `LETTERBOX_COOKIE_SECRET` (`openssl rand -base64 32`; without it every guess endpoint refuses to work, on purpose), `NEXT_PUBLIC_SITE_URL` (the public URL) and `NEXT_PUBLIC_CONTACT_EMAIL` (shown on the Privacy and Terms pages; use an address you are happy to publish).
2. **Party games:** `npx partykit deploy`, then set `NEXT_PUBLIC_PARTYKIT_HOST` to the host it prints and redeploy the web app. The Content-Security-Policy is built from this value, so it must be set at build time.
3. **Never** set `PORTAL_E2E` or `RATE_LIMIT_DISABLED` in production (the first reveals today's answers; the second turns the limiter off).
4. Point an uptime monitor (a free tier is fine) at `/api/health`: it returns 503 if any game cannot build today's puzzle.
5. Before each release run `npm run verify:art` to drop dead artwork links.
6. Check the free-tier limits of every service before inviting people (they change).

Already in place: per-client rate limiting (in-memory, so per server instance), HTTPS-only cookies, security headers and a Content-Security-Policy, party-room persistence across restarts, a profanity filter on display names, retries and caching for the artwork downloads, friendly error and not-found pages, draft Privacy and Terms pages, and a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs every check on each push.

Tests: `npm run lint`, `npx tsc --noEmit`, `npm test`. With a production build running (`npm run build`, `npm start`, `npm run party`):
`npm run e2e:all`, `node e2e/security.mjs`, `node e2e/a11y.mjs`, `node e2e/load.mjs`, `node e2e/party-load.mjs`. Set `BASE=` to
target a specific server, and `BROWSER=firefox` to run the game suites on Firefox. The game tests need a server started with `PORTAL_E2E=1`;
the load test needs `RATE_LIMIT_DISABLED=1`; the security test needs the limiter on.

Needed for a public launch (not built yet; each needs something from the owner):
- **Accounts and a database** (Supabase or similar). Today results live in each browser and attempts are counted in a cookie, so clearing cookies gives unlimited attempts and leagues can't be fair. This also unlocks circles and invite links.
- **A shared rate-limit store** for a hard limit across several server instances (the current limiter is per instance).
- **Error tracking** (e.g. a free Sentry plan): needs an account and a DSN.
- **Legal review** of the draft Privacy and Terms pages (they currently say 18+; confirm the age rule), and a trademark check on the names Portal and Letterbox.
- **Own storage for the pictures** (an object store) instead of fetching from Wikimedia at play time; today they are cached per server with retries.
- **Safari/WebKit testing** on a machine that can run it (it needs system libraries this dev machine lacks); Chromium and Firefox are tested.
- JavaScript is about 145-175 KB gzipped, mostly React and Next.js, above the plan's 120 KB target.

## Not built yet (needs your decisions / accounts)

Accounts and login, circles + invite links + weekly league, nudges and push, server-side share cards
for results, Hintline, Letterbox Duel, Doodle Relay, Mini Grid, real puzzle content and word lists.
The database schema for the dailies is in `supabase/migrations/` and has **not** been applied anywhere.

## Notes

- Dev stand-ins: per-game signed cookies count guesses (replaced by the `daily_attempts` table), and
  player identity is an anonymous id + name on the device (replaced by Supabase Auth).
- Puzzle content is generated by the scripts in `scripts/` into data files under `src/lib/` and `assets/`; see "Puzzle pools" above.
- Deploying Fuse: set `NEXT_PUBLIC_PARTYKIT_HOST` to your PartyKit host and run `npx partykit deploy`.
