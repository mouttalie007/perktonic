import { parse } from "node-html-parser";

export interface FoundLink {
  href: string;
  kind: "link" | "image";
  text: string;
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** Links (<a href>) and images (<img src>) with their anchor or alt text, plus the <base href> if any. */
export function extractLinks(html: string): { base: string | null; links: FoundLink[] } {
  const root = parse(html, { blockTextElements: { script: false, style: false, noscript: false, pre: true } });
  const base = root.querySelector("base[href]")?.getAttribute("href") ?? null;
  const links: FoundLink[] = [];
  for (const a of root.querySelectorAll("a[href]")) {
    const img = a.querySelector("img[alt]");
    const text = squash(a.textContent) || (img ? `[image: ${squash(img.getAttribute("alt") ?? "")}]` : "") || squash(a.getAttribute("aria-label") ?? a.getAttribute("title") ?? "");
    links.push({ href: a.getAttribute("href") ?? "", kind: "link", text: text.slice(0, 120) });
  }
  for (const img of root.querySelectorAll("img")) {
    const src = img.getAttribute("src") ?? img.getAttribute("data-src");
    if (src) links.push({ href: src, kind: "image", text: squash(img.getAttribute("alt") ?? "").slice(0, 120) });
  }
  return { base, links };
}
