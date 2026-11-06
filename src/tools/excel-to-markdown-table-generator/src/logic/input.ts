export const MAX_PASTE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export type FileKind = "xlsx" | "text";

export type SniffResult = { ok: true; kind: FileKind } | { ok: false; error: string };

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  return sig.every((b, i) => bytes[i] === b);
}

/**
 * Decides how to read a file from its first bytes, not its extension.
 * `head` should be the first 8 KB or more of the file.
 */
export function sniffFile(head: Uint8Array, size: number): SniffResult {
  if (size === 0) return { ok: false, error: "This file is empty." };
  if (size > MAX_FILE_BYTES) {
    return { ok: false, error: `This file is ${(size / 1048576).toFixed(1)} MB. The limit is 50 MB.` };
  }
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) return { ok: true, kind: "xlsx" };
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0])) {
    return {
      ok: false,
      error: "This is an old .xls workbook (Excel 97–2003). Open it in Excel or Google Sheets and save it as .xlsx or CSV.",
    };
  }
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46])) {
    return { ok: false, error: "This is a PDF. Upload an .xlsx, .csv or .tsv file, or paste the table instead." };
  }
  const utf16 = startsWith(head, [0xff, 0xfe]) || startsWith(head, [0xfe, 0xff]);
  if (!utf16) {
    for (let i = 0; i < head.length; i++) {
      if (head[i] === 0) {
        return { ok: false, error: "This file is not a spreadsheet or text table. Upload an .xlsx, .csv or .tsv file." };
      }
    }
  }
  return { ok: true, kind: "text" };
}

/** Decodes CSV/TSV bytes: BOM-aware, UTF-8 first, Windows-1252 as a fallback. */
export function decodeText(bytes: Uint8Array): { text: string; encoding: string } {
  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) {
    return { text: new TextDecoder("utf-8").decode(bytes.subarray(3)), encoding: "UTF-8" };
  }
  if (startsWith(bytes, [0xff, 0xfe])) return { text: new TextDecoder("utf-16le").decode(bytes.subarray(2)), encoding: "UTF-16 LE" };
  if (startsWith(bytes, [0xfe, 0xff])) return { text: new TextDecoder("utf-16be").decode(bytes.subarray(2)), encoding: "UTF-16 BE" };
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "UTF-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(bytes), encoding: "Windows-1252" };
  }
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Turns a spreadsheet cell value (from the XLSX reader) into display text. */
export function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const iso = value.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.slice(0, 19).replace("T", " ");
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(15)));
  return String(value);
}
