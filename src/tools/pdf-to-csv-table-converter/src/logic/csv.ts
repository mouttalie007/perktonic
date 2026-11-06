// CSV writing: RFC 4180 quoting, the visitor's delimiter, line endings and encoding (our own encoders).
import { looksLikeFormula, type Table } from "./pdfTables";

export type Delimiter = "," | ";" | "\t" | "|";
export type Encoding = "utf-8" | "utf-8-bom" | "windows-1252" | "iso-8859-1" | "utf-16le-bom";
export type Eol = "\n" | "\r\n";

export interface CsvOptions {
  delimiter: Delimiter;
  eol: Eol;
  /** Prefix an apostrophe to text that a spreadsheet would run as a formula. */
  protect: boolean;
}

export const ENCODINGS: { id: Encoding; label: string }[] = [
  { id: "utf-8", label: "UTF-8" },
  { id: "utf-8-bom", label: "UTF-8 with BOM (for Excel)" },
  { id: "windows-1252", label: "Windows-1252 (Western European)" },
  { id: "iso-8859-1", label: "ISO-8859-1 (Latin-1)" },
  { id: "utf-16le-bom", label: "UTF-16 LE with BOM" },
];

export function field(value: string, o: CsvOptions): string {
  const v = o.protect && looksLikeFormula(value) ? `'${value}` : value;
  return /["\r\n]/.test(v) || v.includes(o.delimiter) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** A table as CSV text. Merged cells keep their text in the first cell only, as in the PDF. */
export function tableCsv(t: Table, o: CsvOptions): string {
  return t.rows.map((r) => r.map((c) => field(c, o)).join(o.delimiter)).join(o.eol) + o.eol;
}

/** All selected tables in one CSV, with a first column "table" holding the table number. */
export function combinedCsv(tables: { table: Table; index: number }[], o: CsvOptions): string {
  const width = Math.max(1, ...tables.map((t) => t.table.rows[0]?.length ?? 0));
  const head = ["table", ...Array.from({ length: width }, (_, i) => `column ${i + 1}`)];
  const lines = [head.map((h) => field(h, o)).join(o.delimiter)];
  for (const { table, index } of tables)
    for (const r of table.rows) {
      const cells = [String(index), ...r, ...Array.from({ length: width - r.length }, () => "")];
      lines.push(cells.map((c) => field(c, o)).join(o.delimiter));
    }
  return lines.join(o.eol) + o.eol;
}

// Windows-1252 bytes 0x80-0x9F (the rest of the code page equals ISO-8859-1).
const CP1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e,
  0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

/** Encodes text; characters the encoding cannot hold become "?" and are counted. */
export function encode(text: string, enc: Encoding): { bytes: Uint8Array; replaced: number } {
  if (enc === "utf-8" || enc === "utf-8-bom") {
    const body = new TextEncoder().encode(text);
    if (enc === "utf-8") return { bytes: body, replaced: 0 };
    const out = new Uint8Array(body.length + 3);
    out.set([0xef, 0xbb, 0xbf]);
    out.set(body, 3);
    return { bytes: out, replaced: 0 };
  }
  if (enc === "utf-16le-bom") {
    const out = new Uint8Array(2 + text.length * 2);
    out.set([0xff, 0xfe]);
    for (let i = 0; i < text.length; i++) {
      const u = text.charCodeAt(i);
      out[2 + i * 2] = u & 0xff;
      out[3 + i * 2] = u >> 8;
    }
    return { bytes: out, replaced: 0 };
  }
  const bytes: number[] = [];
  let replaced = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    let b: number | undefined;
    if (enc === "iso-8859-1") b = cp <= 0xff ? cp : undefined;
    else b = CP1252[cp] ?? (cp <= 0xff && (cp < 0x80 || cp > 0x9f) ? cp : undefined);
    if (b === undefined) {
      replaced++;
      bytes.push(0x3f);
    } else bytes.push(b);
  }
  return { bytes: Uint8Array.from(bytes), replaced };
}

export const csvName = (t: Table, index: number) => `table-${index}-p${t.pages[0]}.csv`;
