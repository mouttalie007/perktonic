import { articleService } from "@/services/article.service";
import { seoService } from "@/services/seo.service";
import { urlsetXml, type SitemapUrl, XML_HEADERS } from "@/lib/sitemap";

export async function GET() {
  const refs = await articleService.listSitemapRefs();
  const urls: SitemapUrl[] = [];

  for (const r of refs) {
    const lastmod = r.updatedAt.toISOString();
    urls.push({
      loc: seoService.absoluteUrl(`/story/${r.slug}`),
      lastmod,
      changefreq: "weekly",
      priority: 0.8,
    });
    // Indexable listicle subpages only (spec discussion — per-article switch).
    if (r.type === "LISTICLE" && r.listicleIndexSubpages) {
      for (let n = 2; n <= r._count.listicleItems; n++) {
        urls.push({
          loc: seoService.absoluteUrl(`/story/${r.slug}/${n}`),
          lastmod,
          changefreq: "weekly",
          priority: 0.6,
        });
      }
    }
  }

  return new Response(urlsetXml(urls), { headers: XML_HEADERS });
}
