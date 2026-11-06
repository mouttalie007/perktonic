import { parse } from "node-html-parser";

export interface PageTags {
  titles: string[];
  description: string | null;
  canonicals: string[];
  robots: string | null;
  googlebot: string | null;
  lang: string | null;
  baseHref: string | null;
  /** og:* properties in document order; og:image and friends can repeat. */
  og: Record<string, string[]>;
  twitter: Record<string, string>;
  /** Raw tags as found, for the report table. */
  raw: { key: string; value: string }[];
}

const MAX_HTML = 2_000_000;

function clean(v: string | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t === "" ? null : t;
}

/** Collects the tags that search engines and link previews read. Only the <head> region is parsed. */
export function extractTags(html: string): PageTags {
  const end = html.search(/<\/head\s*>/i);
  const head = end > 0 ? html.slice(0, end + 7) : html.slice(0, MAX_HTML);
  const doc = parse(head, { lowerCaseTagName: true, comment: false, blockTextElements: { script: false, style: false, noscript: false, pre: true } });
  const tags: PageTags = { titles: [], description: null, canonicals: [], robots: null, googlebot: null, lang: null, baseHref: null, og: {}, twitter: {}, raw: [] };

  const htmlTag = /<html\b[^>]*\blang\s*=\s*["']?([A-Za-z0-9-]+)/i.exec(head);
  tags.lang = htmlTag ? htmlTag[1] : null;
  for (const t of doc.querySelectorAll("title")) {
    const v = clean(t.text);
    if (v) {
      tags.titles.push(v);
      tags.raw.push({ key: "<title>", value: v });
    }
  }
  const base = doc.querySelector("base");
  tags.baseHref = clean(base?.getAttribute("href"));
  for (const link of doc.querySelectorAll("link")) {
    const rel = (link.getAttribute("rel") ?? "").toLowerCase().split(/\s+/);
    const href = clean(link.getAttribute("href"));
    if (rel.includes("canonical") && href) {
      tags.canonicals.push(href);
      tags.raw.push({ key: 'link rel="canonical"', value: href });
    }
  }
  for (const meta of doc.querySelectorAll("meta")) {
    const name = (meta.getAttribute("name") ?? "").toLowerCase().trim();
    const property = (meta.getAttribute("property") ?? "").toLowerCase().trim();
    const content = clean(meta.getAttribute("content"));
    if (content === null) continue;
    const key = property || name;
    if (!key) continue;
    if (name === "description" && tags.description === null) tags.description = content;
    else if (name === "robots") tags.robots = tags.robots ? `${tags.robots}, ${content}` : content;
    else if (name === "googlebot") tags.googlebot = content;
    if (key.startsWith("og:")) (tags.og[key] ??= []).push(content);
    // X reads twitter:* from name= and, leniently, from property=.
    if (key.startsWith("twitter:") && !(key in tags.twitter)) tags.twitter[key] = content;
    if (key === "description" || key === "robots" || key === "googlebot" || key.startsWith("og:") || key.startsWith("twitter:")) tags.raw.push({ key, value: content });
  }
  return tags;
}

export function firstOg(tags: PageTags, key: string): string | null {
  return tags.og[key]?.[0] ?? null;
}

/** Charset from the Content-Type header, then from <meta charset>, defaulting to UTF-8. */
export function detectCharset(contentType: string | null, bytes: Uint8Array): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const sniff = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(sniff)?.[1];
  return (fromMeta ?? "utf-8").toLowerCase();
}

export function decodeHtml(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}
