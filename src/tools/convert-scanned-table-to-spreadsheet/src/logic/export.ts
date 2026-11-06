// .xlsx and .csv output of the edited grid. Text is never written as a formula.
import { merges, texts } from "./grid";
import type { Grid } from "./table";
import { writeXlsx, type XCell } from "./xlsx";

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;
/** Arabic-Indic and Persian digits → 0-9; Arabic decimal and thousands separators → "." and ",". */
export function westernDigits(s: string): string {
  return s.replace(ARABIC_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10)).replace(/٫/g, ".").replace(/[٬،]/g, ",");
}

export const looksLikeFormula = (t: string) => /^[=+\-@\t\r]/.test(t) && !/^[-+]?\d[\d.,]*%?$/.test(t.trim());

/** A number when the whole cell is a plain number (1,234.56 / 1.234,56 / ١٢٣); identifiers with leading zeros stay text. */
export function toNumber(text: string): number | null {
  const s = westernDigits(text.trim()).replace(/[$€£¥]|\s?(SAR|AED|EGP|MAD|USD|EUR|GBP)$/gi, "").trim();
  if (!/^-?\d/.test(s) || /^-?0\d/.test(s)) return null;
  let v: string | null = null;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$|^-?\d+(\.\d+)?$/.test(s)) v = s.replace(/,/g, "");
  else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$|^-?\d+,\d+$/.test(s)) v = s.replace(/\./g, "").replace(",", ".");
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function gridXlsx(pages: { grid: Grid; page: number }[], header: boolean): Uint8Array {
  return writeXlsx(
    pages.map(({ grid, page }) => ({
      name: pages.length > 1 ? `Page ${page}` : "Table",
      rows: texts(grid).map((r, i) =>
        r.map((t): XCell => {
          if (!t) return null;
          if (header && i === 0) return { t: "s", v: t, bold: true, protect: looksLikeFormula(t) };
          const n = toNumber(t);
          return n !== null ? { t: "n", v: n } : { t: "s", v: t, protect: looksLikeFormula(t) };
        }),
      ),
      merges: merges(grid),
      rtl: grid.rtl,
      freezeRows: header ? 1 : 0,
    })),
  );
}

/** CSV (RFC 4180, comma, CRLF, UTF-8 with BOM so Excel reads Arabic and accents). */
export function gridCsv(pages: { grid: Grid; page: number }[]): Uint8Array {
  const field = (v: string) => {
    const t = looksLikeFormula(v) ? `'${v}` : v;
    return /[",\r\n]/.test(t) || /^\s|\s$/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lines: string[] = [];
  pages.forEach(({ grid }, i) => {
    if (i > 0) lines.push("");
    for (const r of texts(grid)) lines.push(r.map(field).join(","));
  });
  const body = new TextEncoder().encode(lines.join("\r\n") + "\r\n");
  const out = new Uint8Array(body.length + 3);
  out.set([0xef, 0xbb, 0xbf]);
  out.set(body, 3);
  return out;
}

export const gridTsv = (g: Grid) => texts(g).map((r) => r.map((t) => t.replace(/[\t\r\n]+/g, " ")).join("\t")).join("\n");
