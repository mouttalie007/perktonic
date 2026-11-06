import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  FootnoteReferenceRun,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx";
import { Lexer, type Token, type Tokens } from "marked";
import type { DocStats, Warning } from "./types";

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
const MAX_IMAGE_WIDTH = 600;
const MONO = "Courier New";

interface Style {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: boolean;
}

interface Ctx {
  warnings: Map<string, Warning>;
  stats: DocStats;
  notes: Map<string, { id: number; text: string }>;
  usedNotes: Set<number>;
  listInstance: number;
}

function warn(ctx: Ctx, feature: string, action: string, level: Warning["level"] = "changed") {
  const w = ctx.warnings.get(feature);
  if (w) w.count++;
  else ctx.warnings.set(feature, { feature, count: 1, action, level });
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
const unescape = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e]);

/** Pixel size from a PNG, JPEG or GIF header, so images keep their proportions. */
export function imageSize(b: Uint8Array): { width: number; height: number; type: "png" | "jpg" | "gif" } | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b.length > 24) {
    const v = new DataView(b.buffer, b.byteOffset);
    return { width: v.getUint32(16), height: v.getUint32(20), type: "png" };
  }
  if (b[0] === 0x47 && b[1] === 0x49 && b.length > 10) return { width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8), type: "gif" };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      const len = (b[i + 2] << 8) | b[i + 3];
      // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC), carry the size.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { width: (b[i + 7] << 8) | b[i + 8], height: (b[i + 5] << 8) | b[i + 6], type: "jpg" };
      i += 2 + len;
    }
  }
  return null;
}

function decodeDataUri(href: string): Uint8Array | null {
  const m = /^data:image\/(png|jpe?g|gif);base64,([A-Za-z0-9+/=\s]+)$/i.exec(href);
  if (!m) return null;
  try {
    const bin = atob(m[2].replace(/\s/g, ""));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function image(token: Tokens.Image, ctx: Ctx): ParagraphChild[] {
  const data = decodeDataUri(token.href);
  const size = data ? imageSize(data) : null;
  if (!data || !size) {
    const remote = /^https?:/i.test(token.href);
    warn(
      ctx,
      remote ? "Images from the web" : "Images that are not embedded",
      remote ? "Not downloaded (the converter never contacts other sites); the alt text and address were written instead." : "Only images inside the Markdown as data: URIs (PNG, JPEG or GIF) can be embedded; the alt text and path were written instead.",
    );
    return [new TextRun({ text: `[${token.text || "image"}: ${token.href.slice(0, 200)}]`, italics: true })];
  }
  ctx.stats.images++;
  const scale = Math.min(1, MAX_IMAGE_WIDTH / Math.max(1, size.width));
  return [
    new ImageRun({
      type: size.type,
      data,
      transformation: { width: Math.round(size.width * scale), height: Math.round(size.height * scale) },
      altText: { name: token.text || "image", description: token.text || "", title: token.title ?? token.text ?? "" },
    }),
  ];
}

function textRuns(text: string, style: Style, ctx: Ctx): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  // Footnote references ([^1]) are plain text to marked.
  const parts = unescape(text).split(/\[\^([^\]\s]+)\]/);
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      const note = ctx.notes.get(part);
      if (note) {
        ctx.usedNotes.add(note.id);
        out.push(new FootnoteReferenceRun(note.id));
        return;
      }
      part = `[^${part}]`;
    }
    if (part) out.push(new TextRun({ text: part, bold: style.bold, italics: style.italics, strike: style.strike, style: style.link ? "Hyperlink" : style.code ? "SourceCodeChar" : undefined, font: style.code ? MONO : undefined, shading: style.code ? { type: ShadingType.CLEAR, fill: "EEF1F5", color: "auto" } : undefined }));
  });
  return out;
}

function inline(tokens: Token[] | undefined, style: Style, ctx: Ctx): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const t of tokens ?? []) {
    switch (t.type) {
      case "text":
        if ("tokens" in t && t.tokens?.length) out.push(...inline(t.tokens, style, ctx));
        else out.push(...textRuns(t.text, style, ctx));
        break;
      case "escape":
        out.push(...textRuns(t.text, style, ctx));
        break;
      case "strong":
        out.push(...inline(t.tokens, { ...style, bold: true }, ctx));
        break;
      case "em":
        out.push(...inline(t.tokens, { ...style, italics: true }, ctx));
        break;
      case "del":
        out.push(...inline(t.tokens, { ...style, strike: true }, ctx));
        break;
      case "codespan":
        out.push(...textRuns(t.text, { ...style, code: true }, ctx));
        break;
      case "br":
        out.push(new TextRun({ text: "", break: 1 }));
        break;
      case "link": {
        ctx.stats.links++;
        const runs = inline(t.tokens, { ...style, link: true }, ctx);
        if (/^(https?:|mailto:)/i.test(t.href)) out.push(new ExternalHyperlink({ link: t.href, children: runs.length ? runs : [new TextRun(t.href)] }));
        else {
          warn(ctx, "Links that are not web addresses", "Word only links to full addresses (https:// or mailto:); relative links and #anchors were kept as plain text.");
          out.push(...runs);
        }
        break;
      }
      case "image":
        out.push(...image(t as Tokens.Image, ctx));
        break;
      case "html":
        warn(ctx, "Inline HTML", "Kept as plain text: Word does not run HTML.");
        out.push(...textRuns(t.text, style, ctx));
        break;
      default:
        if ("text" in t && typeof t.text === "string") out.push(...textRuns(t.text, style, ctx));
    }
  }
  return out;
}

function list(token: Tokens.List, level: number, ctx: Ctx, instance: number): Paragraph[] {
  const out: Paragraph[] = [];
  if (level === 0) ctx.stats.lists++;
  for (const item of token.items) {
    let first = true;
    for (const child of item.tokens) {
      if (child.type === "list") {
        const nested = child as Tokens.List;
        out.push(...list(nested, Math.min(level + 1, 8), ctx, nested.ordered ? ++ctx.listInstance : 0));
        continue;
      }
      const prefix = first && item.task ? [new TextRun(item.checked ? "☑ " : "☐ ")] : [];
      const runs = [...prefix, ...inline("tokens" in child && child.tokens ? child.tokens : [{ type: "text", raw: child.raw, text: "text" in child ? String(child.text) : child.raw } as Token], {}, ctx)];
      out.push(
        first
          ? new Paragraph({ children: runs, ...(token.ordered ? { numbering: { reference: "ordered", level, instance } } : { bullet: { level } }) })
          : new Paragraph({ children: runs, indent: { left: 720 * (level + 1) } }),
      );
      first = false;
    }
  }
  return out;
}

function block(tokens: Token[], ctx: Ctx, quote = false): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case "heading":
        ctx.stats.headings++;
        out.push(new Paragraph({ heading: HEADINGS[t.depth - 1], children: inline(t.tokens, {}, ctx) }));
        break;
      case "paragraph":
        ctx.stats.paragraphs++;
        out.push(new Paragraph({ style: quote ? "Quote" : undefined, children: inline(t.tokens, {}, ctx) }));
        break;
      case "text":
        out.push(new Paragraph({ style: quote ? "Quote" : undefined, children: inline((t as Tokens.Text).tokens ?? [t], {}, ctx) }));
        break;
      case "code": {
        ctx.stats.codeBlocks++;
        if ((t as Tokens.Code).lang) warn(ctx, "Code block languages", "Word has no place for the language name (for example ```js), so it was dropped; the code itself is kept.", "info");
        for (const line of (t as Tokens.Code).text.split("\n")) out.push(new Paragraph({ style: "SourceCode", children: [new TextRun({ text: line, font: MONO })] }));
        break;
      }
      case "blockquote":
        out.push(...block((t as Tokens.Blockquote).tokens, ctx, true));
        break;
      case "list": {
        const l = t as Tokens.List;
        out.push(...list(l, 0, ctx, l.ordered ? ++ctx.listInstance : 0));
        break;
      }
      case "table": {
        ctx.stats.tables++;
        const tb = t as Tokens.Table;
        const align = (a: string | null) => (a === "center" ? AlignmentType.CENTER : a === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT);
        const cell = (c: Tokens.TableCell, i: number, header: boolean) =>
          new TableCell({ children: [new Paragraph({ alignment: align(tb.align[i]), children: inline(c.tokens, { bold: header }, ctx) })] });
        out.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [new TableRow({ tableHeader: true, children: tb.header.map((c, i) => cell(c, i, true)) }), ...tb.rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, i, false)) }))],
          }),
        );
        break;
      }
      case "hr":
        out.push(new Paragraph({ thematicBreak: true, children: [] }));
        break;
      case "html":
        if (!/^\s*<!--[\s\S]*-->\s*$/.test(t.raw)) {
          warn(ctx, "HTML blocks", "Kept as plain text: Word does not run HTML.");
          out.push(new Paragraph({ children: [new TextRun({ text: t.raw.trim(), font: MONO })] }));
        }
        break;
      case "space":
      case "def":
        break;
      default:
        if ("text" in t && typeof t.text === "string") out.push(new Paragraph({ text: t.text }));
    }
  }
  return out;
}

/** Pulls "[^id]: text" definitions (with indented continuation lines) out of the Markdown. */
export function extractFootnotes(md: string): { body: string; notes: Map<string, { id: number; text: string }> } {
  const notes = new Map<string, { id: number; text: string }>();
  const lines = md.split(/\r?\n/);
  const keep: string[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const m = inFence ? null : /^\[\^([^\]\s]+)\]:[ \t]*(.*)$/.exec(line);
    if (!m) {
      keep.push(line);
      continue;
    }
    let text = m[2];
    while (i + 1 < lines.length && /^( {2,}|\t)\S/.test(lines[i + 1])) text += " " + lines[++i].trim();
    if (!notes.has(m[1])) notes.set(m[1], { id: notes.size + 1, text });
  }
  return { body: keep.join("\n"), notes };
}

export interface ToDocxResult {
  docx: Uint8Array;
  warnings: Warning[];
  stats: DocStats;
}

export async function markdownToDocx(markdown: string, title = "Document"): Promise<ToDocxResult> {
  const { body, notes } = extractFootnotes(markdown.replace(/^﻿/, ""));
  const ctx: Ctx = { warnings: new Map(), stats: { headings: 0, paragraphs: 0, lists: 0, tables: 0, images: 0, links: 0, codeBlocks: 0, footnotes: 0 }, notes, usedNotes: new Set(), listInstance: 0 };
  const children = block(new Lexer({ gfm: true }).lex(body), ctx);
  const footnotes: Record<number, { children: Paragraph[] }> = {};
  for (const n of notes.values()) {
    if (!ctx.usedNotes.has(n.id)) {
      warn(ctx, "Footnotes never referenced", "A [^note] definition had no [^note] in the text, so Word cannot show it; it was left out.", "lost");
      continue;
    }
    footnotes[n.id] = { children: [new Paragraph({ children: inline(new Lexer({ gfm: true }).inlineTokens(n.text), {}, ctx) })] };
  }
  ctx.stats.footnotes = ctx.usedNotes.size;
  const doc = new Document({
    title,
    creator: "Perktonic DOCX ↔ Markdown Converter",
    footnotes,
    styles: {
      // Named like Word's own code styles, so the Word → Markdown direction recognises them.
      characterStyles: [{ id: "SourceCodeChar", name: "Source Code Char", run: { font: MONO } }],
      paragraphStyles: [
        { id: "SourceCode", name: "Source Code", basedOn: "Normal", run: { font: MONO, size: 20 }, paragraph: { spacing: { before: 0, after: 0 }, shading: { type: ShadingType.CLEAR, fill: "F3F5F8", color: "auto" } } },
        { id: "Quote", name: "Quote", basedOn: "Normal", run: { italics: true, color: "475569" }, paragraph: { indent: { left: 720 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: "CBD5E1", space: 8 } } } },
      ],
    },
    numbering: {
      config: [
        {
          reference: "ordered",
          levels: Array.from({ length: 9 }, (_, level) => ({ level, format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level % 3], text: `%${level + 1}.`, alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } } })),
        },
      ],
    },
    sections: [{ children: children.length ? children : [new Paragraph("")] }],
  });
  const docx = new Uint8Array(await Packer.toArrayBuffer(doc));
  return { docx, warnings: [...ctx.warnings.values()], stats: ctx.stats };
}
