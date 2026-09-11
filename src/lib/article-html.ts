import { parse, type HTMLElement } from "node-html-parser";
import { slugify } from "./slug";
import { SITE } from "@/config/site";

/**
 * Prepares an article's stored HTML for rendering (spec §25, §27):
 *  - gives every h2/h3 a stable `id` and returns the table of contents
 *  - wraps bare <table> in a horizontally scrollable container
 *  - marks every external link rel="nofollow noopener noreferrer"
 *    target="_blank" (per feedback — implicit on all outbound links); internal
 *    links are left untouched
 *  - splits the body into segments so an in-content ad can be placed after
 *    every Nth paragraph (spec §16, §46)
 *
 * Sanitisation of admin-authored HTML is added in Phase 9; today the input is
 * trusted (seed data / Phase 7 editor output).
 */

const SITE_HOSTNAME = (() => {
  try {
    return new URL(SITE.url).hostname;
  } catch {
    return "";
  }
})();

function markExternalLinks(root: HTMLElement) {
  for (const a of root.querySelectorAll("a")) {
    const href = a.getAttribute("href");
    if (!href) continue;
    let url: URL;
    try {
      url = new URL(href, SITE.url);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    if (url.hostname === SITE_HOSTNAME) continue;
    a.setAttribute("rel", "nofollow noopener noreferrer");
    a.setAttribute("target", "_blank");
  }
}

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface ProcessedArticle {
  toc: TocItem[];
  /** HTML fragments to render in order, with an ad slot between each pair. */
  segments: string[];
}

interface Options {
  adEveryNParagraphs?: number;
  maxAds?: number;
}

export function processArticleHtml(
  html: string,
  opts: Options = {},
): ProcessedArticle {
  if (!html?.trim()) return { toc: [], segments: [] };

  const root = parse(html, { comment: false });

  // --- headings -> ids + toc ---
  const toc: TocItem[] = [];
  const used = new Set<string>();
  for (const h of root.querySelectorAll("h2, h3")) {
    const text = h.text.trim();
    if (!text) continue;
    let id = slugify(text) || `section-${toc.length + 1}`;
    while (used.has(id)) id = `${id}-${used.size}`;
    used.add(id);
    h.setAttribute("id", id);
    toc.push({ id, text, level: h.rawTagName.toLowerCase() === "h2" ? 2 : 3 });
  }

  // --- make tables scrollable ---
  for (const table of root.querySelectorAll("table")) {
    const wrapper = parse(
      '<div class="article-table-wrap"></div>',
    ).firstChild as HTMLElement;
    table.replaceWith(wrapper);
    wrapper.appendChild(table);
  }

  // --- external links: implicit nofollow/noopener/noreferrer + new tab ---
  markExternalLinks(root);

  // --- split for in-content ads ---
  const n = opts.adEveryNParagraphs ?? 0;
  if (n <= 0) return { toc, segments: [root.toString()] };

  const maxAds = opts.maxAds ?? Number.POSITIVE_INFINITY;
  const segments: string[] = [];
  let buf = "";
  let paragraphs = 0;
  let ads = 0;

  for (const node of root.childNodes) {
    buf += node.toString();
    const isPara =
      node.nodeType === 1 &&
      (node as HTMLElement).rawTagName?.toLowerCase() === "p";
    if (isPara) {
      paragraphs++;
      if (paragraphs % n === 0 && ads < maxAds) {
        segments.push(buf);
        buf = "";
        ads++;
      }
    }
  }
  if (buf) segments.push(buf);

  return { toc, segments };
}
