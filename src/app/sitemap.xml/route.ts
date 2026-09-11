import { seoService } from "@/services/seo.service";
import { sitemapIndexXml, XML_HEADERS } from "@/lib/sitemap";

/** Sitemap index (spec §38) — references the three split sitemaps. */
export async function GET() {
  const now = new Date().toISOString();
  const xml = sitemapIndexXml([
    { loc: seoService.absoluteUrl("/sitemap-pages.xml"), lastmod: now },
    { loc: seoService.absoluteUrl("/sitemap-categories.xml"), lastmod: now },
    { loc: seoService.absoluteUrl("/sitemap-posts.xml"), lastmod: now },
  ]);
  return new Response(xml, { headers: XML_HEADERS });
}
