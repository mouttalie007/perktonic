// Amounts are parsed by our code from the string printed on the invoice; the model never computes them.

export type Style = "dot" | "comma";

const toWestern = (s: string) => s.replace(/[٠-٩۰-۹]/g, (c) => String((c.charCodeAt(0) & 0xf) % 10)).replace(/٫/g, ".").replace(/[٬]/g, ",");

/** "dot" = 1,234.56 and "comma" = 1.234,56, decided from every amount-like string in the text. */
export function detectStyle(text: string): Style | null {
  const t = toWestern(text);
  let dot = 0;
  let comma = 0;
  for (const m of t.matchAll(/\d[\d.,' \u00A0\u202F]*\d/g)) {
    const s = m[0].replace(/[\s'\u00A0\u202F]/g, "");
    if (/\d,\d{3}\.\d{1,2}$/.test(s) || /^\d+\.\d{2}$/.test(s)) dot++;
    else if (/\d\.\d{3},\d{1,2}$/.test(s) || /^\d+,\d{2}$/.test(s)) comma++;
  }
  if (dot === comma) return null;
  return dot > comma ? "dot" : "comma";
}

/**
 * Parses "1,234.56", "1.234,56", "€ 89,90", "(12.00)", "12.00-", "١٢٠٫٠٠". A string whose only
 * separator is followed by exactly three digits ("1,234" or "1.234") is ambiguous when the
 * invoice's style is unknown: it is parsed with the guess and flagged.
 */
export function parseAmount(raw: string | null, style: Style | null): { number: number | null; ambiguous: boolean } {
  if (raw === null) return { number: null, ambiguous: false };
  let s = toWestern(raw).trim();
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (/-\s*$/.test(s)) {
    neg = !neg;
    s = s.replace(/-\s*$/, "");
  }
  // Currency signs, codes and units are allowed before or after the number ("£45.00", "1.2 kg",
  // "12.00EUR"); a stray letter glued to the digits ("3.5O") is an OCR misread, not a unit.
  s = s.replace(/^[^\d\-−(]*?(?=[\-−(]?\s*\d)/u, "").trim();
  const tail = /^(.*?\d)\s*([^\d]*)$/u.exec(s);
  if (tail && tail[2]) {
    const glued = s.length > tail[1].length && !/\s/.test(s[tail[1].length]);
    const known = /^(?:[A-Z]{3}|kg|g|mg|l|ml|cl|m|cm|mm|km|h|hr|hrs|pcs|pc|x|%|[$€£¥₹₺₩₪₦₱₫฿₴₽¢]|ر\.س|د\.إ|غ|كغ)\.?$/iu.test(tail[2].trim());
    if (glued && !known) return { number: null, ambiguous: false };
    s = tail[1];
  }
  s = s.replace(/[\s'\u00A0\u202F$€£¥₹]/g, "");
  if (s.startsWith("-") || s.startsWith("−")) {
    neg = !neg;
    s = s.slice(1);
  }
  if (!/^\d[\d.,]*$/.test(s)) return { number: null, ambiguous: false };
  const seps = s.replace(/\d/g, "");
  const last = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  let ambiguous = false;
  let decimalSep: "." | "," | null;
  if (!seps) decimalSep = null;
  else if (new Set(seps).size === 2) decimalSep = s[last] as "." | ",";
  else if (seps.length > 1) decimalSep = seps[0] === "." ? "," : "."; // 1.234.567 → thousands only
  else {
    const after = s.length - last - 1;
    if (after === 3) {
      ambiguous = style === null;
      // With a known style: "1,234" in dot style and "1.234" in comma style are thousands; the other way round, decimals.
      if (style === "dot") decimalSep = seps === "." ? "." : null;
      else if (style === "comma") decimalSep = seps === "," ? "," : null;
      else decimalSep = null;
    } else decimalSep = seps as "." | ",";
  }
  const thousands = decimalSep === "." ? /,/g : decimalSep === "," ? /\./g : /[.,]/g;
  const norm = s.replace(thousands, "").replace(",", ".");
  const n = Number(norm);
  if (!Number.isFinite(n)) return { number: null, ambiguous: false };
  return { number: Math.round((neg ? -n : n) * 100000) / 100000, ambiguous };
}

/** The amount is written in its quote exactly as returned (spaces aside). */
export function writtenIn(value: string, quote: string): boolean {
  const strip = (x: string) => x.replace(/[\s\u00A0\u202F]/g, "");
  return strip(quote).includes(strip(value));
}

/** The digits of an amount occur in the quote ("1,234.50" → 123450 found in "Total 1 234,50"). */
export function digitsIn(value: string, quote: string): boolean {
  const d = toWestern(value).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const q = toWestern(quote).replace(/\D/g, "");
  return d.length > 0 && q.includes(d);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
