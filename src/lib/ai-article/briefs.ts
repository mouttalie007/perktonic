import { slugify } from "@/lib/slug";

/** One brief as it appears in a Content Command Center HTML file (the `A` array). */
export interface BriefData {
  id: number;
  cover: string;
  shots?: string[];
  cat: BriefCategoryKey;
  type: "list" | "guide" | "comparison" | "news";
  title: string;
  pk: string;
  sk: string[];
  intent: string;
  summary: string;
  angle: string;
  hook: string;
  rel: (number | string)[];
  first?: boolean;
  tsens?: boolean;
  /** Filled in by the importer: `rel` resolved to titles + primary keywords. */
  relResolved?: { title: string; pk: string }[];
}

export type BriefCategoryKey = "fs" | "is" | "rt" | "ms";

/** The brief file's category keys -> the site's real category + byline author. */
export const BRIEF_CATEGORIES: Record<
  BriefCategoryKey,
  { name: string; author: string }
> = {
  fs: { name: "Free Samples & Products", author: "PerkTonic Editorial Team" },
  is: {
    name: "Internet Secrets & AI Tools",
    author: "PerkTonic Editorial Team",
  },
  rt: {
    name: "Rewards, Trials & Digital Perks",
    author: "PerkTonic Editorial Team",
  },
  ms: { name: "Money-Saving Guides", author: "PerkTonic Editorial Team" },
};

/**
 * The article's URL slug is ALWAYS slugify(primary keyword) -- the same
 * convention the already-published articles follow (e.g. "free samples by
 * mail" -> /story/free-samples-by-mail). It is forced, never left to the
 * model, because sibling briefs link to each other by exactly this slug.
 */
export function briefSlug(pk: string): string {
  return slugify(pk);
}

export function asBriefData(value: unknown): BriefData {
  return value as BriefData;
}
