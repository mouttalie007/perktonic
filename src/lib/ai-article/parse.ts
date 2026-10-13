import { parse as parseHtml, HTMLElement, TextNode, type Node } from "node-html-parser";

/**
 * Turns the model's reply (the plain-text "Title: ... --- <html body>"
 * format defined in prompt.ts) into a validated, SANITIZED article.
 *
 * The body is LLM output that was written after reading arbitrary web
 * pages, and PerkTonic renders stored article HTML as-is (no render-time
 * sanitising), so everything is rebuilt here from an allow-list: only the
 * tags the format permits survive, every attribute is dropped except a
 * validated <a href>, and anything else (script, iframe, inline handlers,
 * javascript: links) is removed. [IMAGE: ...] tags are lifted out before
 * parsing and put back as literal one-per-line markers afterwards.
 */

export class GenerationParseError extends Error {}

export interface ParsedMarker {
  prompt: string;
  kind: "photo" | "screenshot";
}

export interface ParsedArticle {
  title: string;
  metaDescription: string;
  keywords: string[];
  category: string;
  author: string;
  coverAlt: string;
  /** Sanitized HTML, block elements one per line, literal `[IMAGE: ...]` markers in place. */
  bodyHtml: string;
  markers: ParsedMarker[];
  /** alt text per marker, same order (undefined when the model skipped one) */
  alts: (string | undefined)[];
  warnings: string[];
  wordCount: number;
  externalLinks: number;
}

const ALLOWED = new Set(["h2", "h3", "p", "ul", "ol", "li", "strong", "em", "a", "blockquote", "br"]);
const DROP = new Set([
  "script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea", "select",
  "svg", "math", "noscript", "template", "img", "picture", "video", "audio", "canvas", "link", "meta",
]);
const RENAME: Record<string, string> = { h1: "h2", h4: "h3", h5: "h3", h6: "h3", b: "strong", i: "em" };

const TOKEN = (n: number) => `@@IMG${n}@@`;
const TOKEN_RE = /@@IMG(\d+)@@/g;

function escapeText(s: string): string {
  return s.replace(/&(?!#?\w+;)/g, "&amp;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

interface SanitizeCtx {
  isKnownInternal: (href: string) => boolean;
  warnings: string[];
  stats: { externalLinks: number };
}

function cleanChildren(node: Node, ctx: SanitizeCtx): string {
  return node.childNodes.map((c) => cleanNode(c, ctx)).join("");
}

function cleanNode(node: Node, ctx: SanitizeCtx): string {
  if (node instanceof TextNode) return escapeText(node.rawText);
  if (!(node instanceof HTMLElement)) return "";

  let tag = node.tagName?.toLowerCase() ?? "";
  if (!tag) return cleanChildren(node, ctx);
  if (DROP.has(tag)) return "";
  tag = RENAME[tag] ?? tag;

  if (!ALLOWED.has(tag)) return cleanChildren(node, ctx); // div/span/table/etc: keep the text, lose the wrapper

  if (tag === "br") return "<br>";

  const inner = cleanChildren(node, ctx);
  if (!inner.trim()) return "";

  if (tag === "a") {
    const href = (node.getAttribute("href") ?? "").trim();
    if (/^https?:\/\//i.test(href)) {
      ctx.stats.externalLinks++;
      return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
    }
    if (href.startsWith("/") && !href.startsWith("//")) {
      if (ctx.isKnownInternal(href)) return `<a href="${escapeAttr(href)}">${inner}</a>`;
      ctx.warnings.push(`Removed an internal link to an unknown page: ${href}`);
    }
    return inner; // mailto:, javascript:, #fragments, unknown internal -> keep the words, drop the link
  }

  return `<${tag}>${inner}</${tag}>`;
}

function sanitizeBody(body: string, ctx: SanitizeCtx): string {
  const root = parseHtml(body, { blockTextElements: { script: false, noscript: false, style: false, pre: false } });
  const pieces: string[] = [];
  for (const child of root.childNodes) {
    if (child instanceof TextNode) {
      const t = escapeText(child.rawText).trim();
      if (!t) continue;
      // A bare token stays bare; bare prose gets a paragraph so it renders as one.
      pieces.push(/^(@@IMG\d+@@\s*)+$/.test(t) ? t : `<p>${t}</p>`);
      continue;
    }
    const html = cleanNode(child, ctx).trim();
    if (!html) continue;
    // An unwrapped <div>/<span> can leave loose prose at the top level: give it a paragraph.
    pieces.push(html.startsWith("<") || /^(@@IMG\d+@@\s*)+$/.test(html) ? html : `<p>${html}</p>`);
  }
  return pieces.join("\n");
}

function cleanTitle(s: string): string {
  return s
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/^#+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/\.$/, "")
    .trim();
}

/** Keeps a meta description inside 160 characters without an ellipsis. */
export function fitMetaDescription(s: string): string {
  const t = s.replace(/\s+/g, " ").replace(/^["“]|["”]$/g, "").trim();
  if (t.length <= 160) return t;
  const cut = t.slice(0, 159);
  const sentenceEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (sentenceEnd > 90) return cut.slice(0, sentenceEnd + 1).trim();
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\-–—]+$/, "").trim();
}

function plainWordCount(html: string): number {
  return html
    .replace(TOKEN_RE, " ")
    .replace(/<[^>]*>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function parseGeneratedArticle(
  raw: string,
  opts: { isKnownInternal: (href: string) => boolean },
): ParsedArticle {
  let text = raw.replace(/\r\n/g, "\n").trim();

  // Tolerate a fenced reply even though the prompt forbids it.
  const fence = text.match(/^```[a-z]*\n([\s\S]*?)\n```\s*$/i);
  if (fence) text = fence[1].trim();

  const start = text.search(/^Title:/im);
  if (start < 0) throw new GenerationParseError("The reply has no 'Title:' line, so it isn't an article in the expected format.");
  text = text.slice(start);

  // Header / body split: the first line that is only ---.
  const sep = text.match(/^[ \t]*---[ \t]*$/m);
  let header: string;
  let rest: string;
  if (sep && sep.index !== undefined) {
    header = text.slice(0, sep.index);
    rest = text.slice(sep.index + sep[0].length);
  } else {
    const firstBlock = text.search(/^(<[a-z]|\[IMAGE:)/im);
    if (firstBlock < 0) throw new GenerationParseError("The reply has no '---' separator and no article body.");
    header = text.slice(0, firstBlock);
    rest = text.slice(firstBlock);
  }

  const fields: Record<string, string> = {};
  for (const line of header.split("\n")) {
    const m = line.match(/^\s*([A-Za-z][A-Za-z ]{1,30}):\s*(.*)$/);
    if (m) fields[m[1].toLowerCase().trim()] = m[2].trim();
  }
  const title = cleanTitle(fields["title"] ?? "");
  if (!title) throw new GenerationParseError("The reply's Title line is empty.");

  // Body / alts split.
  let bodyRaw = rest;
  let altsRaw = "";
  const altsSep = rest.match(/^[ \t]*---[ \t]*ALTS[ \t]*---[ \t]*$/im);
  if (altsSep && altsSep.index !== undefined) {
    bodyRaw = rest.slice(0, altsSep.index);
    altsRaw = rest.slice(altsSep.index + altsSep[0].length);
  }

  // Lift [IMAGE: ...] tags out before parsing so the HTML parser never sees them.
  const markers: ParsedMarker[] = [];
  const tokenized = bodyRaw.replace(/\[IMAGE:\s*([^\]]+)\]/g, (_m, p: string) => {
    const prompt = p.trim().replace(/\s+/g, " ");
    markers.push({ prompt, kind: /^SCREENSHOT:/i.test(prompt) ? "screenshot" : "photo" });
    return `\n${TOKEN(markers.length - 1)}\n`;
  });

  const warnings: string[] = [];
  const stats = { externalLinks: 0 };
  let body = sanitizeBody(tokenized, { isKnownInternal: opts.isKnownInternal, warnings, stats });

  // A marker that ended up wrapped in its own <p> (or any block) goes back to being a bare line.
  body = body.replace(/<(p|li|blockquote)>\s*(@@IMG\d+@@)\s*<\/\1>/g, "$2");
  body = body.replace(TOKEN_RE, (_m, n: string) => `[IMAGE: ${markers[Number(n)].prompt}]`);
  body = body.replace(/\n{2,}/g, "\n").trim();

  const wordCount = plainWordCount(body.replace(/\[IMAGE:[^\]]*\]/g, " "));
  if (!/<h2>/.test(body)) throw new GenerationParseError("The article body has no <h2> sections.");
  if (wordCount < 300) {
    throw new GenerationParseError(`The article body is only ${wordCount} words, so it looks truncated or incomplete.`);
  }
  if (wordCount < 700) warnings.push(`Short article (${wordCount} words) — check it covers the headline's promise.`);
  if (!/Quick answer/i.test(body)) warnings.push("No 'Quick answer' paragraph found.");
  if (!/Frequently asked questions/i.test(body)) warnings.push("No FAQ section found.");
  if (stats.externalLinks === 0) warnings.push("No external source links — the model may not have researched. Review before publishing.");
  else if (stats.externalLinks < 3) warnings.push(`Only ${stats.externalLinks} external source link(s) (the brief asks for 3-6).`);
  if (markers.length === 0) warnings.push("The article has no image tags (only the cover image).");

  const alts: (string | undefined)[] = markers.map(() => undefined);
  for (const line of altsRaw.split("\n")) {
    const m = line.match(/^\s*(\d{1,2})\s*[:.)\-–]\s*(.+?)\s*$/);
    if (!m) continue;
    const i = Number(m[1]) - 1;
    if (i >= 0 && i < alts.length) alts[i] = m[2].replace(/^["“]|["”]$/g, "").slice(0, 160);
  }

  return {
    title,
    metaDescription: fitMetaDescription(fields["meta description"] ?? ""),
    keywords: (fields["keywords"] ?? "")
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8),
    category: fields["category"] ?? "",
    author: fields["author"] ?? "",
    coverAlt: (fields["cover alt"] ?? "").replace(/^["“]|["”]$/g, "").slice(0, 160),
    bodyHtml: body,
    markers,
    alts,
    warnings,
    wordCount,
    externalLinks: stats.externalLinks,
  };
}
