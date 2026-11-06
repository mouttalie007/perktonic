import type { AmountOutput, CurrencyLabel, DecimalStyle, Outcome } from "./types";

export const SYMBOLS: Record<string, string> = { $: "USD", "US$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₹": "INR", "CHF": "CHF", "C$": "CAD", "A$": "AUD", "R$": "BRL", "₺": "TRY", "₽": "RUB", "₩": "KRW", "₪": "ILS", "DH": "MAD", "DHS": "MAD", "MAD": "MAD", "د.م.": "MAD" };
const SYMBOL_OF: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", INR: "₹", CAD: "C$", AUD: "A$", BRL: "R$", TRY: "₺", RUB: "₽", KRW: "₩", ILS: "₪" };
export const CURRENCY_CODES = ["USD", "EUR", "GBP", "MAD", "CAD", "AUD", "CHF", "JPY", "INR", "AED", "SAR", "BRL", "TRY", "ZAR", "SEK", "NOK", "DKK", "PLN", "MXN", "CNY"];

const CURRENCY_RE = new RegExp(String.raw`(US\$|C\$|A\$|R\$|د\.م\.|[$€£¥₹₺₽₩₪]|\b(?:${CURRENCY_CODES.join("|")}|DHS?)\b)`, "i");

export interface ParsedAmount {
  value: number;
  /** Digits after the decimal mark as written, for output precision. */
  decimals: number;
  currency: string | null;
}

/** Splits currency and number. Accepts "(1,234.56)" and "-1 234,56" as negatives. */
export function splitCurrency(raw: string): { currency: string | null; number: string; negative: boolean } | null {
  let s = raw.trim().replace(/ | /g, " ");
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  let currency: string | null = null;
  const m = CURRENCY_RE.exec(s);
  if (m) {
    const t = m[1].toUpperCase();
    currency = SYMBOLS[m[1]] ?? SYMBOLS[t] ?? t;
    s = (s.slice(0, m.index) + s.slice(m.index + m[1].length)).trim();
  }
  if (/^[-−]/.test(s)) {
    negative = !negative;
    s = s.slice(1).trim();
  } else if (/[-−]$/.test(s)) {
    negative = !negative;
    s = s.slice(0, -1).trim();
  }
  if (!/^\d[\d\s.,']*$/.test(s) || /\d\s+\D|\s{2,}/.test(s)) return null;
  return { currency, number: s.replace(/[\s']/g, ""), negative };
}

/** How one value's separators vote: "dot", "comma", or null when it could be either (1,234 or 1.234) or has none. */
export function decimalVote(number: string): DecimalStyle | null {
  const lastDot = number.lastIndexOf(".");
  const lastComma = number.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) return lastDot > lastComma ? "dot" : "comma";
  const sep = lastDot >= 0 ? "." : lastComma >= 0 ? "," : null;
  if (!sep) return null;
  const parts = number.split(sep);
  const tail = parts[parts.length - 1];
  // Several identical separators can only be thousands separators: 1.234.567 / 1,234,567.
  if (parts.length > 2) return sep === "." ? "comma" : "dot";
  if (tail.length === 3) return null;
  return sep === "." ? "dot" : "comma";
}

export interface ColumnGuess {
  style: DecimalStyle;
  currency: string | null;
  evidence: number;
  ambiguous: number;
}

/** Guesses a column's decimal mark and main currency from all its values. */
export function guessColumn(values: string[]): ColumnGuess {
  let dot = 0;
  let comma = 0;
  let ambiguous = 0;
  const currencies = new Map<string, number>();
  for (const v of values) {
    const s = splitCurrency(v);
    if (!s) continue;
    if (s.currency) currencies.set(s.currency, (currencies.get(s.currency) ?? 0) + 1);
    const vote = decimalVote(s.number);
    if (vote === "dot") dot++;
    else if (vote === "comma") comma++;
    else if (/[.,]/.test(s.number)) ambiguous++;
  }
  const currency = [...currencies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { style: comma > dot ? "comma" : "dot", currency, evidence: Math.max(dot, comma), ambiguous };
}

export function parseAmount(raw: string, style: DecimalStyle): ParsedAmount | null {
  const s = splitCurrency(raw);
  if (!s) return null;
  const [thousands, decimal] = style === "dot" ? [",", "."] : [".", ","];
  const parts = s.number.split(decimal);
  if (parts.length > 2) return null;
  const intPart = parts[0];
  // Thousands separators must group by three: 1,234,567 is fine, 12,34 is not.
  if (intPart.includes(thousands) && !(style === "dot" ? /^\d{1,3}(,\d{3})+$/ : /^\d{1,3}(\.\d{3})+$/).test(intPart)) return null;
  const digits = intPart.split(thousands).join("") + (parts.length === 2 ? "." + parts[1] : "");
  if (!/^\d+(\.\d+)?$/.test(digits)) return null;
  const value = Number(digits) * (s.negative ? -1 : 1);
  return { value, decimals: parts.length === 2 ? parts[1].length : 0, currency: s.currency };
}

export function formatAmount(value: number, decimals: number, out: AmountOutput, currency: string | null, label: CurrencyLabel): string {
  const d = Math.max(decimals, 2);
  const fixed = Math.abs(value).toFixed(d);
  const [int, frac] = fixed.split(".");
  const group = (sep: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const num =
    out === "1234.56" ? `${int}.${frac}` : out === "1,234.56" ? `${group(",")}.${frac}` : out === "1.234,56" ? `${group(".")},${frac}` : `${group(" ")},${frac}`;
  const sign = value < 0 ? "-" : "";
  if (!currency || label === "none") return sign + num;
  const symbol = SYMBOL_OF[currency] ?? currency;
  if (label === "code-before") return `${currency} ${sign}${num}`;
  if (label === "symbol-before") return symbol.length > 1 && symbol === currency ? `${currency} ${sign}${num}` : `${sign}${symbol}${num}`;
  return `${sign}${num} ${symbol}`;
}

/** One amount → the chosen format. A value in another currency is not converted: it is listed as invalid. */
export function standardizeAmount(raw: string, style: DecimalStyle, target: string | null, out: AmountOutput, label: CurrencyLabel): Outcome {
  if (raw.trim() === "") return { kind: "empty" };
  const p = parseAmount(raw, style);
  if (!p) return { kind: "invalid", reason: `not an amount in the ${style === "dot" ? "1,234.56" : "1.234,56"} format` };
  if (p.currency && target && p.currency !== target) return { kind: "invalid", reason: `in ${p.currency}, not ${target}; currencies are not converted` };
  const value = formatAmount(p.value, p.decimals, out, target ?? p.currency, label);
  return value === raw ? { kind: "unchanged", value } : { kind: "changed", value };
}
