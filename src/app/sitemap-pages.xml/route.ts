import { pageService } from "@/services/page.service";
import { seoService } from "@/services/seo.service";
import { TOOLS, toolHref } from "@/config/tools";
import { urlsetXml, type SitemapUrl, XML_HEADERS } from "@/lib/sitemap";

export async function GET() {
  const pages = await pageService.listIndexable();

  const urls: SitemapUrl[] = [
    { loc: seoService.absoluteUrl("/"), changefreq: "daily", priority: 1.0 },
    { loc: seoService.absoluteUrl("/tools"), changefreq: "weekly", priority: 0.9 },
    { loc: seoService.absoluteUrl("/blog"), changefreq: "daily", priority: 0.8 },
    ...TOOLS.filter((t) => t.status === "live").map((t) => ({
      loc: seoService.absoluteUrl(toolHref(t)),
      changefreq: "monthly" as const,
      priority: 0.8,
    })),
    ...pages.map((p) => ({
      loc: seoService.absoluteUrl(`/${p.slug}`),
      lastmod: p.updatedAt.toISOString(),
      changefreq: "monthly" as const,
      priority: 0.4,
    })),
  ];

  return new Response(urlsetXml(urls), { headers: XML_HEADERS });
}
