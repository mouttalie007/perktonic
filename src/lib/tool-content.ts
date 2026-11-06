import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Page copy of a tool, written by the tool's developer in
 * `src/tools/<slug>/content.md` (front matter + `## Section` blocks) with the
 * SEO fields in `meta.json`. Read at build time; the pages are static.
 */
export interface ToolMeta {
  title: string;
  metaDescription: string;
  h1: string;
  primaryKeyword: string;
  secondaryKeywords?: string[];
  relatedSlugs?: string[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ToolContent {
  meta: ToolMeta;
  /** The "Hero" section: the intro paragraph shown under the H1. */
  hero: string;
  /** Every other section, in file order. */
  sections: { title: string; body: string }[];
  faq: FaqItem[];
}

const TOOLS_DIR = path.join(process.cwd(), "src", "tools");
const cache = new Map<string, ToolContent>();

const read = (slug: string, file: string) =>
  fs.readFileSync(path.join(TOOLS_DIR, slug, file), "utf8").replace(/\r\n/g, "\n");

function parseFaq(body: string): FaqItem[] {
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .map((block) => {
      const m = block.match(/^\*\*(.+?)\*\*\s*\n([\s\S]+)$/);
      return m ? { question: m[1].trim(), answer: m[2].trim().replace(/\n/g, " ") } : null;
    })
    .filter((x): x is FaqItem => x !== null);
}

export function getToolContent(slug: string): ToolContent {
  const hit = cache.get(slug);
  if (hit) return hit;

  const meta = JSON.parse(read(slug, "meta.json")) as ToolMeta;
  const body = read(slug, "content.md").replace(/^---\n[\s\S]*?\n---\n?/, "");

  const sections: { title: string; body: string }[] = [];
  for (const part of body.split(/^## /m).slice(1)) {
    const nl = part.indexOf("\n");
    sections.push({ title: part.slice(0, nl).trim(), body: part.slice(nl + 1).trim() });
  }
  // The hero is shown as plain text under the H1, so drop inline Markdown marks.
  const hero = (sections.find((s) => /^hero$/i.test(s.title))?.body ?? "").replace(/`/g, "").replace(/\*\*/g, "");
  const rest = sections.filter((s) => !/^hero$/i.test(s.title));
  const faq = parseFaq(rest.find((s) => /^faq$/i.test(s.title))?.body ?? "");

  const content = { meta, hero, sections: rest, faq };
  cache.set(slug, content);
  return content;
}
