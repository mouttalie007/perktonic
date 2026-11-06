export const MAX_PASTE_BYTES = 5 * 1024 * 1024;
/** CSV files are streamed, so they may be larger than JSON files, which must be parsed whole. */
export const MAX_CSV_FILE_BYTES = 200 * 1024 * 1024;
export const MAX_JSON_FILE_BYTES = 50 * 1024 * 1024;

export const ENCODINGS = [
  { id: "auto", label: "Detect automatically" },
  { id: "utf-8", label: "UTF-8" },
  { id: "utf-16le", label: "UTF-16 LE" },
  { id: "utf-16be", label: "UTF-16 BE" },
  { id: "windows-1252", label: "Windows-1252 (Western)" },
  { id: "iso-8859-1", label: "ISO-8859-1 (Latin-1)" },
  { id: "windows-1256", label: "Windows-1256 (Arabic)" },
  { id: "windows-1251", label: "Windows-1251 (Cyrillic)" },
  { id: "shift_jis", label: "Shift_JIS (Japanese)" },
  { id: "gb18030", label: "GB18030 (Chinese)" },
] as const;

export type EncodingId = (typeof ENCODINGS)[number]["id"];

export type InputKind = "csv" | "json";

/** Guesses the direction from the first non-space character. */
export function sniffKind(text: string): InputKind {
  const t = text.replace(/^﻿/, "").trimStart();
  return t.startsWith("{") || t.startsWith("[") ? "json" : "csv";
}

/**
 * Detects the text encoding from a BOM, then by checking whether the sample
 * is valid UTF-8. A multi-byte character cut at the end of the sample is
 * tolerated so a 64 KB slice of a valid file never fails.
 */
export function detectEncoding(sample: Uint8Array): { encoding: Exclude<EncodingId, "auto">; bom: number } {
  if (sample[0] === 0xef && sample[1] === 0xbb && sample[2] === 0xbf) return { encoding: "utf-8", bom: 3 };
  if (sample[0] === 0xff && sample[1] === 0xfe) return { encoding: "utf-16le", bom: 2 };
  if (sample[0] === 0xfe && sample[1] === 0xff) return { encoding: "utf-16be", bom: 2 };
  let end = sample.length;
  // Step back over a trailing incomplete UTF-8 sequence (at most 3 bytes).
  for (let i = 1; i <= 3 && end - i >= 0; i++) {
    const b = sample[end - i];
    if ((b & 0xc0) === 0x80) continue;
    if (b >= 0xc0) {
      const need = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : 2;
      if (i < need) end -= i;
    }
    break;
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample.subarray(0, end));
    return { encoding: "utf-8", bom: 0 };
  } catch {
    return { encoding: "windows-1252", bom: 0 };
  }
}

export type FileCheck = { ok: true; kind: InputKind } | { ok: false; error: string };

/** Checks size and magic bytes before reading a file. `head` is its first bytes, ideally 8 KB. */
export function checkFile(head: Uint8Array, size: number, decodedHead: string): FileCheck {
  if (size === 0) return { ok: false, error: "This file is empty." };
  const startsWith = (sig: number[]) => sig.every((b, i) => head[i] === b);
  if (startsWith([0x50, 0x4b, 0x03, 0x04])) {
    return { ok: false, error: "This is a ZIP or Excel (.xlsx) file. Export the sheet as CSV first, then convert it here." };
  }
  if (startsWith([0xd0, 0xcf, 0x11, 0xe0])) return { ok: false, error: "This is an old Excel (.xls) file. Save it as CSV first." };
  if (startsWith([0x25, 0x50, 0x44, 0x46])) return { ok: false, error: "This is a PDF, not a CSV or JSON file." };
  if (startsWith([0x89, 0x50, 0x4e, 0x47]) || startsWith([0xff, 0xd8, 0xff]) || startsWith([0x47, 0x49, 0x46])) {
    return { ok: false, error: "This is an image, not a CSV or JSON file." };
  }
  const utf16 = startsWith([0xff, 0xfe]) || startsWith([0xfe, 0xff]);
  if (!utf16 && head.includes(0)) return { ok: false, error: "This looks like a binary file. Upload a CSV, TSV or JSON text file." };
  const kind = sniffKind(decodedHead);
  const limit = kind === "csv" ? MAX_CSV_FILE_BYTES : MAX_JSON_FILE_BYTES;
  if (size > limit) {
    const mb = (size / 1048576).toFixed(2);
    return {
      ok: false,
      error: kind === "csv" ? `This file is ${mb} MB. CSV files can be up to 200 MB.` : `This JSON file is ${mb} MB. JSON files can be up to 50 MB.`,
    };
  }
  return { ok: true, kind };
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
