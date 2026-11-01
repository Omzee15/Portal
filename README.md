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
| Bundle | Effectively unlimited (3,000 days verified distinct) | Generated from 132 categories / ~1,350 words; ambiguous boards are rejected (`scripts/build-categories.mjs`) |
| Odd One | Same generator | Exactly one valid answer per round, checked |
| Wordsplice | ~10,300 words, each with a WordNet definition as the clue | `scripts/build-splice.mjs`; 7 words per day, never the same set |
| Sudoku | Unlimited | Seeded generator, unique solution guaranteed; 34 / 29 / 25 clues |
| Pixel Peek | Famous public-domain artworks + a few photos | `scripts/build-pixel-art.mjs` (Wikidata + Wikimedia Commons) |
| Emoji Decode | 157, hand-checked | Emoji clues can't be generated reliably, so this pool repeats after a few months |

The category data for Bundle/Odd One is in `scripts/categories-source.mjs`; completion groups ("___ball") are checked
against a dictionary at build time so only real compounds survive. Rebuild any pool with its script in `scripts/`.

## Going live

**Ready for a closed beta with friends** (everything below under "Needed for a public launch" is optional for that).

Deploy checklist:
1. Web app: deploy to Vercel (free tier) and set `LETTERBOX_COOKIE_SECRET` (`openssl rand -base64 32`). Without it every guess endpoint refuses to work, on purpose. Set `NEXT_PUBLIC_SITE_URL` to the public URL.
2. Party games: `npx partykit deploy`, then set `NEXT_PUBLIC_PARTYKIT_HOST` to the host it prints and redeploy the web app.
3. Never set `PORTAL_E2E` in production (it enables a test endpoint that reveals today's answers).
4. Check the free-tier limits of every service before inviting people (they change).

Tests: `npm run lint`, `npx tsc --noEmit`, `npm test`, then with a production build and `npm run party` running,
`npm run e2e:all`, plus `node e2e/security.mjs`, `node e2e/a11y.mjs`, `node e2e/load.mjs` and `node e2e/party-load.mjs`
(pass `BASE=http://localhost:3101` to run them against a server started without `PORTAL_E2E`).

Needed for a public launch (not built yet):
- Accounts and a database. Today results live in each browser and attempts are counted in a cookie, so clearing cookies gives unlimited attempts and leagues can't be fair.
- Rate limiting on the API (none today; needs a shared store such as a free Redis tier).
- Party room state is held in memory only; add persistence so a restart doesn't drop live games.
- Privacy policy, terms and an age floor.
- Error monitoring and uptime checks (free tiers exist).
- A copy of the pictures in your own storage instead of fetching from Wikimedia at play time.
- A CI workflow (GitHub Actions is free), and a trademark check on the product name.
- JS size is about 145-175 KB gzipped, mostly React and Next.js, above the plan's 120 KB target.

## Not built yet (needs your decisions / accounts)

Accounts and login, circles + invite links + weekly league, nudges and push, server-side share cards
for results, Hintline, Letterbox Duel, Doodle Relay, Mini Grid, real puzzle content and word lists.
The database schema for the dailies is in `supabase/migrations/` and has **not** been applied anywhere.

## Notes

- Dev stand-ins: per-game signed cookies count guesses (replaced by the `daily_attempts` table), and
  player identity is an anonymous id + name on the device (replaced by Supabase Auth).
- Puzzle content is generated by the scripts in `scripts/` into data files under `src/lib/` and `assets/`; see "Puzzle pools" above.
- Deploying Fuse: set `NEXT_PUBLIC_PARTYKIT_HOST` to your PartyKit host and run `npx partykit deploy`.
