// How a cell's text becomes a spreadsheet value. Identifiers stay text: leading zeros, a "+" prefix,
// phone numbers and dates are never turned into numbers.

export type NumberStyle = "auto" | "dot" | "comma";
export type CellValue = { kind: "number"; value: number; percent: boolean } | { kind: "text"; value: string };

const DATE = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$|^\d{1,2}\s+[A-Za-z]{3,}\.?\s+\d{2,4}$|^[A-Za-z]{3,}\.?\s+\d{1,2},?\s+\d{4}$/;
const CURRENCY = /^[$€£¥₹]|[$€£¥₹]$|\s?(USD|EUR|GBP|CHF|JPY|CAD|AUD|SAR|AED|EGP|MAD)$/i;

/** "dot" = 1,234.56 ; "comma" = 1.234,56. Decides from the texts of a whole table. */
export function guessStyle(texts: string[]): "dot" | "comma" {
  let dot = 0;
  let comma = 0;
  for (const t of texts) {
    const s = t.replace(/\s/g, "");
    if (/\d,\d{3}\.\d+/.test(s) || /^\d+\.\d{1,2}$/.test(s.replace(/[^\d.,]/g, ""))) dot++;
    if (/\d\.\d{3},\d+/.test(s) || /^\d+,\d{1,2}$/.test(s.replace(/[^\d.,]/g, ""))) comma++;
  }
  return comma > dot ? "comma" : "dot";
}

export function toValue(raw: string, style: "dot" | "comma"): CellValue {
  const text = raw.trim();
  const keep: CellValue = { kind: "text", value: raw };
  if (!text || !/\d/.test(text)) return keep;
  if (/^\+/.test(text) || DATE.test(text)) return keep;
  // Phone numbers and codes: digit groups joined by dashes, or a bracketed area code followed by more digits.
  if (/^\(?\d{2,4}\)?[\s-]\d{2,4}[\s-]?\d{2,6}$/.test(text) && !/[.,]\d{1,2}$/.test(text) && /-|\)\s/.test(text)) return keep;
  let s = text.replace(CURRENCY, "").trim();
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (/^[-−]/.test(s)) {
    negative = !negative;
    s = s.slice(1).trim();
  }
  s = s.replace(CURRENCY, "").trim();
  const percent = s.endsWith("%");
  if (percent) s = s.slice(0, -1).trim();
  // Leading zeros mark identifiers (00123), but 0.5 and 0,5 are numbers.
  if (/^0\d/.test(s)) return keep;
  const thousands = style === "dot" ? /[,\s'’\u00A0\u202F]/g : /[.\s'’\u00A0\u202F]/g;
  const decimal = style === "dot" ? "." : ",";
  const groupOk = style === "dot" ? /^\d{1,3}(?:[,\s'’\u00A0\u202F]\d{3})*(?:\.\d+)?$|^\d+(?:\.\d+)?$/ : /^\d{1,3}(?:[.\s'’\u00A0\u202F]\d{3})*(?:,\d+)?$|^\d+(?:,\d+)?$/;
  if (!groupOk.test(s)) return keep;
  const n = Number(s.replace(thousands, "").replace(decimal, "."));
  if (!Number.isFinite(n)) return keep;
  const v = (negative ? -n : n) / (percent ? 100 : 1);
  return { kind: "number", value: Math.round(v * 1e10) / 1e10, percent };
}

/** A text that a spreadsheet would run as a formula (and is not a plain number). */
export function looksLikeFormula(text: string): boolean {
  return /^[=+\-@\t\r]/.test(text) && !/^[-+]?\d[\d.,]*%?$/.test(text.trim());
}
