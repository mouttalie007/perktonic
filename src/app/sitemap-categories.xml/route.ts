import { categoryService } from "@/services/category.service";
import { seoService } from "@/services/seo.service";
import { CATEGORIES } from "@/config/site";
import { TOOLS } from "@/config/tools";
import { urlsetXml, XML_HEADERS } from "@/lib/sitemap";

export async function GET() {
  const categories = await categoryService.listIndexable();
  // Tool categories are listed once they have a live tool; article categories once they have an article.
  const toolSlugs = CATEGORIES.filter((c) => TOOLS.some((t) => t.categorySlug === c.slug && t.status === "live")).map(
    (c) => c.slug,
  );
  const lastmod = new Map(categories.map((c) => [c.slug, c.updatedAt]));
  for (const slug of toolSlugs) if (!lastmod.has(slug)) lastmod.set(slug, new Date());
  const urls = [...lastmod].map(([slug, updatedAt]) => ({
    loc: seoService.absoluteUrl(`/category/${slug}`),
    lastmod: updatedAt.toISOString(),
    changefreq: "daily" as const,
    priority: 0.7,
  }));
  return new Response(urlsetXml(urls), { headers: XML_HEADERS });
}
