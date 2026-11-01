import type { NextConfig } from "next";

// Content-Security-Policy for production builds (development needs looser rules for hot reload).
// connect-src must include the party-game server, which the browser reaches over a WebSocket.
const partyHost = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "127.0.0.1:1999";
const partyLocal = /^(localhost|127\.|192\.168\.|10\.)/.test(partyHost);
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // Next.js hydration data is inline; no third-party scripts are allowed
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${partyLocal ? "ws" : "wss"}://${partyHost}`,
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
const prod = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The pictures are read from disk at runtime and must be bundled with the Pixel Peek routes.
  outputFileTracingIncludes: { "/api/pixel/**": ["./assets/pixel/**"] },
  partialPrefetching: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(prod
            ? [
                { key: "Content-Security-Policy", value: csp },
                // browsers only honour this over HTTPS, so it is harmless on http://localhost
                { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
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
