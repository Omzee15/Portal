import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The pictures are read from disk at runtime and must be bundled with the Pixel Peek routes.
  outputFileTracingIncludes: { "/api/pixel/**": ["./assets/pixel/**"] },
  partialPrefetching: true,
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
