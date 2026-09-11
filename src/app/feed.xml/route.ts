import { articleService } from "@/services/article.service";
import { siteSettingsService } from "@/services/site-settings.service";
import { seoService } from "@/services/seo.service";
import { SITE } from "@/config/site";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** RSS 2.0 feed of the latest published stories (spec §40). Canonical URLs only. */
export async function GET() {
  const [items, settings] = await Promise.all([
    articleService.listLatest({ limit: 30 }),
    siteSettingsService.getSiteSettings(),
  ]);

  const entries = items
    .map((a) => {
      const link = seoService.absoluteUrl(`/story/${a.slug}`);
      const bits = [
        `    <title>${esc(a.title)}</title>`,
        `    <link>${link}</link>`,
        `    <guid isPermaLink="true">${link}</guid>`,
      ];
      if (a.publishedAt) {
        bits.push(`    <pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>`);
      }
      if (a.category) bits.push(`    <category>${esc(a.category.name)}</category>`);
      if (a.excerpt) bits.push(`    <description>${esc(a.excerpt)}</description>`);
      if (a.featuredImage?.url) {
        bits.push(`    <enclosure url="${esc(a.featuredImage.url)}" type="image/jpeg" />`);
      }
      return `  <item>\n${bits.join("\n")}\n  </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${esc(settings.siteName)}</title>
  <link>${SITE.url}</link>
  <description>${esc(SITE.description)}</description>
  <language>en-us</language>
${entries}
</channel>
</rss>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
