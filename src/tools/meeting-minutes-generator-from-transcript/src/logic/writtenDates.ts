// Our own date reader, used to check that an ISO date returned by the model is written in its quote.

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

/** ISO dates written in a text with Arabic-Indic digits too. */
export const datesInAny = (text: string) => datesIn(text.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (c) => String((c.charCodeAt(0) & 0xf) % 10)));
