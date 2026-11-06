import { gfm } from "@joplin/turndown-plugin-gfm";
// The browser build never touches `document` when it is given a DOM node, so it also runs in a Worker.
import TurndownService from "turndown/lib/turndown.browser.es.js";
import type { DocStats } from "./types";

/** A DOM document, from domino in the worker and in tests. */
export interface DomDocument {
  body: HTMLElement;
  createElement(tag: string): HTMLElement;
  createTextNode(text: string): Text;
}

type El = HTMLElement;
const all = (root: ParentNode, sel: string) => Array.from(root.querySelectorAll(sel)) as El[];

/** Mammoth writes footnotes as <sup><a href="#footnote-1">[1]</a></sup> plus a numbered list at the end. */
function collectNotes(doc: DomDocument, td: TurndownService): { refs: number; notes: string[] } {
  const notes: string[] = [];
  let refs = 0;
  const label = new Map<string, string>();
  let next = 1;
  for (const kind of ["footnote", "endnote"]) {
    for (const a of all(doc.body, `a[href^="#${kind}-"]`)) {
      const href = a.getAttribute("href")!;
      // Skip the "↑" links that point back from the note to the text.
      if (href.startsWith(`#${kind}-ref-`)) continue;
      const id = href.slice(1);
      if (!label.has(id)) label.set(id, String(next++));
      const sup = a.parentElement?.nodeName === "SUP" ? a.parentElement : a;
      // A marker turndown leaves alone; "[^1]" itself would be escaped to "\[^1\]".
      sup.replaceWith(doc.createTextNode(`⁅fn${label.get(id)}⁆`));
      refs++;
    }
  }
  for (const [id, n] of label) {
    const li = doc.body.querySelector(`li[id="${id}"]`) as El | null;
    if (!li) continue;
    for (const back of all(li, `a[href^="#footnote-ref-"], a[href^="#endnote-ref-"]`)) back.remove();
    const md = td
      .turndown(li)
      .trim()
      .replace(/\n+/g, (m) => (m.length > 1 ? "\n\n    " : "\n    "));
    notes.push(`⁅fn${n}⁆: ${md}`);
    const list = li.parentElement;
    li.remove();
    if (list && list.children.length === 0) list.remove();
  }
  return { refs, notes };
}

/**
 * Prepares mammoth's HTML for Markdown: <pre> without <code> becomes a code
 * block, a table without header cells gets its first row as the header, and
 * merged cells are padded so every row has the same number of columns.
 */
function normalise(doc: DomDocument): { headerless: number } {
  for (const pre of all(doc.body, "pre")) {
    if (pre.querySelector("code")) continue;
    const code = doc.createElement("code");
    code.textContent = pre.textContent;
    pre.textContent = "";
    pre.appendChild(code);
  }
  let headerless = 0;
  for (const table of all(doc.body, "table")) {
    const rows = all(table, "tr");
    // Expand colspan and rowspan into empty cells.
    const pending: Map<number, number>[] = rows.map(() => new Map());
    rows.forEach((tr, r) => {
      let col = 0;
      for (const cell of Array.from(tr.children) as El[]) {
        while (pending[r].has(col)) {
          const blank = doc.createElement(cell.nodeName.toLowerCase());
          tr.insertBefore(blank, cell);
          col++;
        }
        const span = Math.max(1, Number(cell.getAttribute("colspan") ?? 1));
        const rspan = Math.max(1, Number(cell.getAttribute("rowspan") ?? 1));
        cell.removeAttribute("colspan");
        cell.removeAttribute("rowspan");
        for (let k = 1; k < span; k++) cell.after(doc.createElement(cell.nodeName.toLowerCase()));
        for (let k = 1; k < rspan && r + k < rows.length; k++) for (let c = 0; c < span; c++) pending[r + k].set(col + c, 1);
        col += span;
      }
      while (pending[r].has(col)) {
        tr.appendChild(doc.createElement("td"));
        col++;
      }
    });
    if (!table.querySelector("th") && rows[0]) {
      headerless++;
      for (const td of Array.from(rows[0].children) as El[]) {
        const th = doc.createElement("th");
        while (td.firstChild) th.appendChild(td.firstChild);
        td.replaceWith(th);
      }
    }
  }
  return { headerless };
}

function service(): TurndownService {
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-", emDelimiter: "*", strongDelimiter: "**", br: "\\" });
  td.use(gfm);
  // One space after the marker ("- item", "1. item") instead of turndown's three.
  td.addRule("listItem", {
    filter: "li",
    replacement(content, node, options) {
      const parent = node.parentNode as El | null;
      let prefix = `${options.bulletListMarker} `;
      if (parent?.nodeName === "OL") {
        const start = Number(parent.getAttribute("start") ?? 1);
        prefix = `${start + Array.prototype.indexOf.call(parent.children, node)}. `;
      }
      const body = content.replace(/^\n+/, "").replace(/\n+$/, "\n").replace(/\n/gm, `\n${" ".repeat(prefix.length)}`);
      return prefix + body + (node.nextSibling && !/\n$/.test(body) ? "\n" : "");
    },
  });
  return td;
}

export function htmlToMarkdown(doc: DomDocument): { markdown: string; footnotes: number; headerlessTables: number } {
  const td = service();
  const { headerless } = normalise(doc);
  const { refs, notes } = collectNotes(doc, td);
  // Turndown slows to a crawl on multi-megabyte attributes, so data: URIs are swapped for short markers and put back afterwards.
  const uris: string[] = [];
  for (const img of all(doc.body, "img")) {
    const src = img.getAttribute("src") ?? "";
    if (src.length > 200) {
      img.setAttribute("src", `perktonic-image-${uris.length}`);
      uris.push(src);
    }
  }
  let md = td.turndown(doc.body).trim();
  md = md.replace(/\(perktonic-image-(\d+)\)/g, (_, i: string) => `(${uris[Number(i)]})`);
  if (notes.length) md += `\n\n${notes.join("\n\n")}`;
  md = md.replace(/⁅fn(\d+)⁆/g, "[^$1]");
  return { markdown: md.replace(/\n{3,}/g, "\n\n") + "\n", footnotes: refs, headerlessTables: headerless };
}

export function htmlStats(doc: DomDocument): DocStats {
  const n = (sel: string) => doc.body.querySelectorAll(sel).length;
  return {
    headings: n("h1, h2, h3, h4, h5, h6"),
    paragraphs: n("p"),
    lists: n("ul, ol") - doc.body.querySelectorAll("li ul, li ol").length,
    tables: n("table"),
    images: n("img"),
    links: n('a[href^="http"], a[href^="mailto:"]'),
    codeBlocks: n("pre"),
    footnotes: n('a[id^="footnote-ref-"], a[id^="endnote-ref-"]'),
  };
}

/** Mammoth style map: Word's code and title styles, which mammoth does not know by default. */
export const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => p:fresh",
  "p[style-name='Source Code'] => pre:separator('\\n')",
  "p[style-name='Code'] => pre:separator('\\n')",
  "p[style-name='HTML Preformatted'] => pre:separator('\\n')",
  "p[style-name='Quote'] => blockquote > p:fresh",
  "p[style-name='Intense Quote'] => blockquote > p:fresh",
  "r[style-name='Source Code Char'] => code",
  "r[style-name='HTML Code'] => code",
];
