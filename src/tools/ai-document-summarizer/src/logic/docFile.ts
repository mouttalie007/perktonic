// Reading a document chosen by the visitor, in the browser. Pure checks here; .docx text extraction
// lives in readDocx.ts (mammoth, loaded only when a .docx is opened).

export type FileKind = "text" | "docx" | "pdf" | "doc" | "other";

export const PDF_MESSAGE = "PDF files are not supported yet. Copy the text out of your PDF (select all, copy) and paste it here.";

const starts = (head: Uint8Array, sig: number[]) => sig.every((b, i) => head[i] === b);

/** What the file really is, from its first bytes (magic bytes) and its extension. */
export function sniff(name: string, head: Uint8Array, allowed: { md: boolean; docx: boolean }): { kind: FileKind; error: string | null } {
  const ext = (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? "").toLowerCase();
  if (starts(head, [0x25, 0x50, 0x44, 0x46]) || ext === "pdf") return { kind: "pdf", error: PDF_MESSAGE };
  if (starts(head, [0xd0, 0xcf, 0x11, 0xe0])) return { kind: "doc", error: "This is an old Word .doc file. Save it as .docx in Word or LibreOffice, or copy the text and paste it." };
  if (starts(head, [0x50, 0x4b, 0x03, 0x04])) {
    if (ext === "docx" && allowed.docx) return { kind: "docx", error: null };
    return { kind: "other", error: allowed.docx ? "This ZIP-based file is not a .docx Word document. Copy the text and paste it." : "Word files are not supported here. Copy the text and paste it." };
  }
  const textExt = ext === "txt" || (allowed.md && (ext === "md" || ext === "markdown"));
  if (ext === "docx") return { kind: "other", error: "This file is named .docx but is not a Word document." };
  if (!textExt) return { kind: "other", error: `Open a ${["a .txt", allowed.md ? ".md" : "", allowed.docx ? ".docx" : ""].filter(Boolean).join(", ")} file, or paste the text.` };
  return { kind: "text", error: null };
}

export type TextRead = { ok: true; text: string } | { ok: false; error: string };

/** Decode a plain-text file: UTF-8 (with or without BOM), UTF-16 with BOM, else Windows-1252. */
export function decodeText(bytes: Uint8Array): TextRead {
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) return { ok: true, text: new TextDecoder(bytes[0] === 0xff ? "utf-16le" : "utf-16be").decode(bytes) };
  if (bytes.includes(0)) return { ok: false, error: "This file is not plain text." };
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "") };
  } catch {
    return { ok: true, text: new TextDecoder("windows-1252").decode(bytes) };
  }
}

/** Line endings normalised, empty refused, over-long refused (v1 does not split long texts). */
export function limitText(text: string, max: number): TextRead {
  const t = text.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!t) return { ok: false, error: "The file has no text (a scanned document has only images of text)." };
  if (t.length > max) return { ok: false, error: `The document has ${t.length.toLocaleString("en-US")} characters; the limit is ${max.toLocaleString("en-US")}. This version does not split long documents: open or paste one part at a time.` };
  return { ok: true, text: t };
}
