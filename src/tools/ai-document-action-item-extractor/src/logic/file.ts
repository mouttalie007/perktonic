// Reading a .txt or .md file in the browser: extension, size, and content checks (text, not binary).
import { MAX_FILE_BYTES, MAX_TEXT_CHARS } from "../limits";

export type FileRead = { ok: true; text: string } | { ok: false; error: string };

export function decodeTextFile(name: string, bytes: Uint8Array): FileRead {
  if (!/\.(txt|md|markdown)$/i.test(name)) return { ok: false, error: "Open a .txt or .md file. For Word or PDF files, copy the text and paste it." };
  if (bytes.length > MAX_FILE_BYTES) return { ok: false, error: `The file is larger than ${MAX_FILE_BYTES / 1024} KB. This version does not split long texts: paste it in parts.` };
  // Magic bytes: text files have no NUL bytes; PDFs, ZIP-based Office files and images do.
  if (bytes.subarray(0, 4).every((b, i) => b === [0x25, 0x50, 0x44, 0x46][i])) return { ok: false, error: "This is a PDF, not a text file. Copy the text and paste it." };
  if (bytes.subarray(0, 2).every((b, i) => b === [0x50, 0x4b][i])) return { ok: false, error: "This is a Word, Excel or ZIP file, not a text file. Copy the text and paste it." };
  if (bytes.includes(0)) {
    // UTF-16 text (from some Windows editors) starts with a byte-order mark.
    if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) {
      const text = new TextDecoder(bytes[0] === 0xff ? "utf-16le" : "utf-16be").decode(bytes);
      return limit(text);
    }
    return { ok: false, error: "This file is not plain text." };
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Older Windows files: Latin-1 / Windows-1252.
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return limit(text.replace(/^﻿/, ""));
}

function limit(text: string): FileRead {
  const t = text.replace(/\r\n?/g, "\n");
  if (t.length > MAX_TEXT_CHARS) return { ok: false, error: `The file has ${t.length.toLocaleString("en-US")} characters; the limit is ${MAX_TEXT_CHARS.toLocaleString("en-US")}. This version does not split long texts: open a shorter part.` };
  if (!t.trim()) return { ok: false, error: "The file is empty." };
  return { ok: true, text: t };
}
