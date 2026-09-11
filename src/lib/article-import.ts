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
  category?: string;
  tags?: string[];
}

type FieldKey = Exclude<keyof ParsedArticleMeta, "tags">;

const LABELS: Record<string, FieldKey | "tags"> = {
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
  category: "category",
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
Category: Tech
Tags: AI, Internet, Automation`;
