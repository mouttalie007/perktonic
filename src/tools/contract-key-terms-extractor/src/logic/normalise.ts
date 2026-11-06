// "normalised stays null when the date or amount is not literally in the quote": our own readers of
// dates and amounts, used to verify what the model normalised.

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";

const pad = (n: number) => String(n).padStart(2, "0");
function iso(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
}
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS_RE = `(${MOIS.join("|")}|fevrier|aout|decembre)`;
const monthNum = (s: string) => MONTHS.findIndex((m) => m.startsWith(s.toLowerCase().replace(".", "").slice(0, 3))) + 1;
const moisNum = (s: string) => {
  const t = s.toLowerCase().replace("fevrier", "février").replace("aout", "août").replace("decembre", "décembre");
  return MOIS.indexOf(t) + 1;
};

/** Every calendar date written in a text, as ISO (both readings of 01/02/2026 are kept). */
export function datesIn(text: string): Set<string> {
  const out = new Set<string>();
  const add = (v: string | null) => v && out.add(v);
  for (const m of text.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) add(iso(+m[1], +m[2], +m[3]));
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\s*,?\\s+(\\d{4})\\b`, "gi"))) add(iso(+m[3], monthNum(m[2]), +m[1]));
  for (const m of text.matchAll(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s+(\\d{4})\\b`, "gi"))) add(iso(+m[3], monthNum(m[1]), +m[2]));
  // French: "1er septembre 2026", "15 mars 2026".
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:er)?\\s+${MOIS_RE}\\s+(\\d{4})\\b`, "gi"))) add(iso(+m[3], moisNum(m[2]), +m[1]));
  for (const m of text.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) {
    add(iso(+m[3], +m[2], +m[1]));
    add(iso(+m[3], +m[1], +m[2]));
  }
  return out;
}

/** Every amount written in a text, as a number ("12,500", "12.500,00", "1.2 million", "€3k"). */
export function amountsIn(text: string): number[] {
  const out: number[] = [];
  const re = /(\d{1,3}(?:[,.\s  ']\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d+)?)\s*(million|billion|thousand|m|bn|k)?\b/gi;
  for (const m of text.matchAll(re)) {
    let raw = m[1].replace(/[\s  ']/g, "");
    const lastSep = Math.max(raw.lastIndexOf(","), raw.lastIndexOf("."));
    if (lastSep >= 0) {
      const decimals = raw.length - lastSep - 1;
      const isDecimal = decimals !== 3 || (raw.includes(",") && raw.includes("."));
      const intPart = raw.slice(0, lastSep).replace(/[.,]/g, "");
      raw = isDecimal && decimals !== 3 ? `${intPart}.${raw.slice(lastSep + 1)}` : raw.replace(/[.,]/g, "");
    }
    let n = Number(raw);
    if (!Number.isFinite(n)) continue;
    const mult = (m[2] ?? "").toLowerCase();
    if (mult === "million" || mult === "m") n *= 1e6;
    else if (mult === "billion" || mult === "bn") n *= 1e9;
    else if (mult === "thousand" || mult === "k") n *= 1e3;
    out.push(n);
  }
  return out;
}

export type Normalised = string | { amount: number; currency: string } | null;

/** Keep the model's normalised value only when it is literally in the quote; otherwise null. */
export function verifyNormalised(value: Normalised, quote: string): Normalised {
  if (value === null) return null;
  if (typeof value === "string") return datesIn(quote).has(value) ? value : null;
  return amountsIn(quote).some((n) => Math.abs(n - value.amount) < 0.005) ? value : null;
}
