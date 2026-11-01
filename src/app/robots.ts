import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    // Room pages are private invites; the API is not for crawlers.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/r/", "/q/"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
