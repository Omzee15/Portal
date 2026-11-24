import type { NextConfig } from "next";

import { cleanPartyHost, isLocalHost } from "./src/lib/party-host";

// Content-Security-Policy for production builds (development needs looser rules for hot reload).
// connect-src must include the party-game server, which the browser reaches over a WebSocket.
const hosted = Boolean(process.env.VERCEL || process.env.NETLIFY);
const rawPartyHost = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
const partyHost = cleanPartyHost(rawPartyHost);
// A hosted build without a real party host ships rooms that can never connect, so refuse to build it.
// (The CSP and the client both bake this value in at build time.)
if (hosted && (!partyHost || isLocalHost(partyHost)))
  throw new Error(
    `NEXT_PUBLIC_PARTYKIT_HOST is ${rawPartyHost ? `"${rawPartyHost}", which is not a deployed party-server host` : "not set"}. ` +
      "Run `npx wrangler deploy`, set NEXT_PUBLIC_PARTYKIT_HOST to the host it prints (e.g. portal-party.you.workers.dev), then redeploy.",
  );
if (rawPartyHost && !partyHost) console.warn(`⚠ NEXT_PUBLIC_PARTYKIT_HOST "${rawPartyHost}" is not a usable host; falling back to port 1999 on the page's own machine.`);
// A public site must publish who handles complaints and data requests (India's IT Rules and DPDP Act).
if (hosted && (!process.env.NEXT_PUBLIC_CONTACT_EMAIL || !process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER))
  console.warn("⚠ Set NEXT_PUBLIC_CONTACT_EMAIL and NEXT_PUBLIC_GRIEVANCE_OFFICER: the Privacy and Terms pages need a named contact.");
const partyLocal = !partyHost || isLocalHost(partyHost);
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // Next.js hydration data is inline; no third-party scripts are allowed
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self'",
  // With no host set the rooms use port 1999 on whichever machine served the page (see partyHost in src/lib/browser.ts)
  `connect-src 'self' ${partyLocal ? "ws" : "wss"}://${partyHost ?? "*:1999"}`,
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Only on the real site: `npm run lan` serves a production build over plain http, which this would break.
  ...(hosted ? ["upgrade-insecure-requests"] : []),
].join("; ");
const permissions = [
  "camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()", "serial=()", "hid=()", "bluetooth=()",
  "midi=()", "magnetometer=()", "gyroscope=()", "accelerometer=()", "display-capture=()", "browsing-topics=()",
].join(", ");
const prod = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't advertise the framework
  cacheComponents: true,
  // lets another device on the wifi use `npm run dev`; dev only, it has no effect on a production build
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*", "*.local"],
  // The pictures are read from disk at runtime and must be bundled with every route that loads them.
  outputFileTracingIncludes: { "/api/pixel/**": ["./assets/pixel/**"], "/api/health": ["./assets/pixel/**"], "/api/e2e-answers": ["./assets/pixel/**"] },
  partialPrefetching: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: permissions },
          // Another site can't keep a handle on this window (e.g. via window.open) or read it cross-process.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Origin-Agent-Cluster", value: "?1" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          ...(prod
            ? [
                { key: "Content-Security-Policy", value: csp },
                // browsers only honour this over HTTPS, so it is harmless on http://localhost
                { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
              ]
            : []),
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
