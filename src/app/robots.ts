import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";

/**
 * robots.txt (spec §39). Allows normal crawling; blocks only genuinely
 * private/internal paths. Thin/duplicate pages (search, tags) are handled
 * with `noindex` rather than a crawl block, so their directive is actually
 * seen — see spec §75.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/*",
          "/api/private",
          "/api/private/*",
          "/internal",
          "/internal/*",
          "/private",
          "/private/*",
        ],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
