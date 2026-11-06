import { articleService } from "@/services/article.service";

const LINK_RE = /<a\s[^>]*?href="\/blog\/([a-z0-9-]+)(?:[/?#][^"]*)?"[^>]*>([\s\S]*?)<\/a>/g;

/**
 * Guides link to each other. While a guide is scheduled (publishedAt in the future) a link to it
 * would be a 404, so until it goes live its link is replaced by plain text; the next time the
 * page is rebuilt after that date the link is back.
 */
export async function unlinkUnpublished(html: string): Promise<string> {
  const slugs = [...new Set([...html.matchAll(LINK_RE)].map((m) => m[1]))];
  if (slugs.length === 0) return html;
  const live = await articleService.publishedSlugs(slugs);
  return html.replace(LINK_RE, (whole, slug: string, text: string) => (live.has(slug) ? whole : text));
}
