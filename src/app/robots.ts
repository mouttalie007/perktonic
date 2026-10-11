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
          // The admin path is intentionally NOT listed here -- its pages
          // already carry a noindex meta tag (see admin layout/login), and
          // naming it here would just advertise the hidden URL to anyone
          // who reads robots.txt.
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
