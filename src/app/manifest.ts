import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Portal",
    short_name: "Portal",
    description: "Your portal for all games: daily puzzles, live party games and a journal that writes itself.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2eadb",
    theme_color: "#f2eadb",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
