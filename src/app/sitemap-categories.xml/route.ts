import { categoryService } from "@/services/category.service";
import { seoService } from "@/services/seo.service";
import { urlsetXml, XML_HEADERS } from "@/lib/sitemap";

export async function GET() {
  const categories = await categoryService.listIndexable();
  const urls = categories.map((c) => ({
    loc: seoService.absoluteUrl(`/category/${c.slug}`),
    lastmod: c.updatedAt.toISOString(),
    changefreq: "daily" as const,
    priority: 0.7,
  }));
  return new Response(urlsetXml(urls), { headers: XML_HEADERS });
}
