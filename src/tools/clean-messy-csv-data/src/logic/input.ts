export const MAX_PASTE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export type FileKind = "xlsx" | "text";
export type FileCheck = { ok: true; kind: FileKind } | { ok: false; error: string };

/** Decides how to read a file from its size and first bytes (magic numbers), never from the extension alone. */
export function checkFile(head: Uint8Array, size: number): FileCheck {
  if (size === 0) return { ok: false, error: "This file is empty." };
  if (size > MAX_FILE_BYTES) return { ok: false, error: `This file is ${(size / 1048576).toFixed(2)} MB. The limit is 50 MB.` };
  const starts = (sig: number[]) => sig.every((b, i) => head[i] === b);
  if (starts([0x50, 0x4b, 0x03, 0x04])) return { ok: true, kind: "xlsx" };
  if (starts([0xd0, 0xcf, 0x11, 0xe0])) {
    return { ok: false, error: "This is an old .xls workbook (Excel 97–2003). Save it as .xlsx or CSV and try again." };
  }
  if (starts([0x25, 0x50, 0x44, 0x46])) return { ok: false, error: "This is a PDF. Upload a CSV, TSV or .xlsx file." };
  if (starts([0x89, 0x50, 0x4e, 0x47]) || starts([0xff, 0xd8, 0xff])) return { ok: false, error: "This is an image. Upload a CSV, TSV or .xlsx file." };
  const utf16 = starts([0xff, 0xfe]) || starts([0xfe, 0xff]);
  if (!utf16 && head.includes(0)) return { ok: false, error: "This file contains binary data, so it is not a CSV. Upload a CSV, TSV or .xlsx file." };
  return { ok: true, kind: "text" };
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Turns an XLSX cell (string, number, boolean, Date or null) into text. */
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
