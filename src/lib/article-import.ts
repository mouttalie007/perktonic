import { slugify } from "./slug";

/**
 * Parses the "meta" box of the article Import tab. Format — one label per
 * line, value follows the colon (or continues on the lines below it until
 * the next recognised label):
 *
 *   Title: How AI Is Changing Our Lives in 2026
 *   Slug: how-ai-is-changing-our-lives-in-2026
 *   Excerpt: From automated research to creative tools, AI is reshaping
 *   everyday workflows.
 *   SEO Title: How AI Is Changing Work in 2026: What You Need to Know
 *   Meta Description: A look at how AI tools are changing daily workflows,
 *   from research to creative work.
 *   Keywords: AI tools, free AI tools, internet tricks
 *   Category: Tech
 *   Tags: AI, Internet, Automation
 *
 * Every line is optional; unrecognised lines are ignored unless they
 * continue the value of the label above them. This format is deliberately
 * plain so it is trivial to produce by hand or paste from an AI tool.
 */

export interface ParsedArticleMeta {
  title?: string;
  slug?: string;
  excerpt?: string;
  seoTitle?: string;
  metaDescription?: string;
  /** Comma-separated in the paste; first one seeds pasted-image alt text
   *  (perktonic workflow, 2026-10-09 — see QuickArticlePanel/altBase). */
  keywords?: string[];
  category?: string;
  /** Matched against Author.name (see quick-article.ts's AUTHOR_FOR_CATEGORY note on why the piece states this itself rather than us re-deriving it from category). */
  author?: string;
  tags?: string[];
}

type FieldKey = Exclude<keyof ParsedArticleMeta, "tags" | "keywords">;

const LABELS: Record<string, FieldKey | "tags" | "keywords"> = {
  title: "title",
  slug: "slug",
  excerpt: "excerpt",
  dek: "excerpt",
  "excerpt / dek": "excerpt",
  "seo title": "seoTitle",
  "seo-title": "seoTitle",
  description: "metaDescription",
  "meta description": "metaDescription",
  "meta-description": "metaDescription",
  keywords: "keywords",
  category: "category",
  author: "author",
  tags: "tags",
};

export function parseMetaBlock(raw: string): ParsedArticleMeta {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const collected: Record<string, string> = {};
  let currentKey: string | null = null;

  for (const line of lines) {
    const m = /^([A-Za-z][A-Za-z \-/]{1,30}):\s?(.*)$/.exec(line);
    const label = m?.[1]?.trim().toLowerCase();
    const mapped = label ? LABELS[label] : undefined;
    if (mapped) {
      currentKey = mapped;
      collected[currentKey] = (m?.[2] ?? "").trim();
    } else if (currentKey && line.trim()) {
      collected[currentKey] = collected[currentKey]
        ? `${collected[currentKey]}\n${line.trim()}`
        : line.trim();
    }
  }

  for (const key of Object.keys(collected)) {
    collected[key] = collected[key].trim();
  }

  return {
    title: collected.title || undefined,
    slug: collected.slug ? slugify(collected.slug) : undefined,
    excerpt: collected.excerpt || undefined,
    seoTitle: collected.seoTitle || undefined,
    metaDescription: collected.metaDescription || undefined,
    category: collected.category || undefined,
    author: collected.author || undefined,
    keywords: collected.keywords
      ? collected.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean)
      : undefined,
    tags: collected.tags
      ? collected.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined,
  };
}

export const META_BLOCK_EXAMPLE = `Title: How AI Is Changing Our Lives in 2026
Slug: how-ai-is-changing-our-lives-in-2026
Excerpt: From automated research to creative tools, AI is reshaping everyday workflows.
SEO Title: How AI Is Changing Work in 2026: What You Need to Know
Meta Description: A look at how AI tools are changing daily workflows, from research to creative work.
Keywords: AI tools, free AI tools, internet tricks
Category: Internet Secrets & AI Tools
Author: Alex Carter
Tags: AI, Internet, Automation`;
