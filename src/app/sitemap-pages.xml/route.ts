import { pageService } from "@/services/page.service";
import { seoService } from "@/services/seo.service";
import { urlsetXml, type SitemapUrl, XML_HEADERS } from "@/lib/sitemap";

export async function GET() {
  const pages = await pageService.listIndexable();

  const urls: SitemapUrl[] = [
    { loc: seoService.absoluteUrl("/"), changefreq: "daily", priority: 1.0 },
    ...pages.map((p) => ({
      loc: seoService.absoluteUrl(`/${p.slug}`),
      lastmod: p.updatedAt.toISOString(),
      changefreq: "monthly" as const,
      priority: 0.4,
    })),
  ];

  return new Response(urlsetXml(urls), { headers: XML_HEADERS });
}
