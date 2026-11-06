import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";
import type { Category, Entity, Options } from "./types";

interface Hit {
  value: string;
  normalized: string;
  /** Dedup key: case-insensitive where the category is. */
  key: string;
  index: number;
  extra?: string;
}

// ---------------------------------------------------------------- helpers

/** Blanks out found spans so later categories (phones, URLs) do not re-read them. */
function mask(text: string, spans: { index: number; length: number }[]): string {
  if (!spans.length) return text;
  const parts: string[] = [];
  let pos = 0;
  for (const s of [...spans].sort((a, b) => a.index - b.index)) {
    if (s.index < pos) continue;
    parts.push(text.slice(pos, s.index), " ".repeat(s.length));
    pos = s.index + s.length;
  }
  parts.push(text.slice(pos));
  return parts.join("");
}

// push(...list) overflows the call stack for very long lists (hundreds of thousands of hits in a 20 MB file).
function append(out: Hit[], list: Hit[]): void {
  for (const h of list) out.push(h);
}

function all(re: RegExp, text: string, fn: (m: RegExpExecArray) => Hit | null): Hit[] {
  const out: Hit[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const h = fn(m);
    if (h) out.push(h);
    if (m[0] === "") re.lastIndex++;
  }
  return out;
}

// ---------------------------------------------------------------- emails

const EMAIL = /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]+@(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+[\p{L}]{2,63}(?![\p{L}\p{N}-])/gu;

export function emails(text: string): Hit[] {
  return all(EMAIL, text, (m) => {
    const v = m[0].replace(/^[.]+|[.]+$/g, "");
    if (v.includes("..")) return null;
    const [local, domain] = v.split("@");
    const normalized = `${local}@${domain.toLowerCase()}`;
    const plus = local.indexOf("+");
    return { value: v, normalized, key: normalized.toLowerCase(), index: m.index, extra: plus > 0 ? `base address ${local.slice(0, plus)}@${domain.toLowerCase()}` : undefined };
  });
}

// ---------------------------------------------------------------- URLs

const TLDS = "com|org|net|io|co|ai|app|dev|edu|gov|info|biz|me|tv|uk|us|ca|de|fr|es|it|nl|be|ch|at|se|no|dk|fi|pl|pt|ie|eu|au|nz|jp|cn|in|br|mx|ru|za|sg|hk|xyz|online|site|shop|store|tech|cloud|blog|news";
const URL_WITH_SCHEME = /\b(?:https?|ftp):\/\/[^\s<>"'`]+/gi;
const URL_WWW = /(?<![\w@./-])www\.[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+(?:[/?#][^\s<>"'`]*)?/giu;
const URL_BARE = new RegExp(String.raw`(?<![\w@./-])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:${TLDS})(?=[/:?#]|[\s,;)\]]|$)(?::\d{2,5})?(?:[/?#][^\s<>"'\x60]*)?`, "giu");

function trimUrl(raw: string): string {
  let u = raw.replace(/[.,;:!?'"]+$/, "");
  // A closing bracket belongs to the URL only if it opens one too (Wikipedia-style links).
  while (u.endsWith(")") && (u.match(/\(/g)?.length ?? 0) < (u.match(/\)/g)?.length ?? 0)) u = u.slice(0, -1);
  return u.replace(/[.,;:!?'"]+$/, "");
}

function urlKey(u: string): string {
  try {
    const p = new URL(u);
    return `${p.protocol}//${p.host.toLowerCase()}${p.pathname}${p.search}${p.hash}`;
  } catch {
    return u.toLowerCase();
  }
}

export function urls(text: string): Hit[] {
  const out: Hit[] = [];
  const spans: { index: number; length: number }[] = [];
  const add = (m: RegExpExecArray, needsScheme: boolean): Hit | null => {
    const value = trimUrl(m[0]);
    if (value.length < 4) return null;
    const normalized = needsScheme ? `https://${value}` : value;
    try {
      new URL(normalized);
    } catch {
      return null;
    }
    spans.push({ index: m.index, length: value.length });
    return { value, normalized, key: urlKey(normalized), index: m.index, extra: needsScheme ? "https:// added" : undefined };
  };
  append(out, all(URL_WITH_SCHEME, text, (m) => add(m, false)));
  const t2 = mask(text, spans);
  append(out, all(URL_WWW, t2, (m) => add(m, true)));
  const t3 = mask(text, spans);
  append(out, all(URL_BARE, t3, (m) => add(m, true)));
  return out.sort((a, b) => a.index - b.index);
}

// ---------------------------------------------------------------- IP addresses

const IPV4 = /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![\d.]*\d)/g;
const IPV6_CANDIDATE = /(?<![\w:])(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}(?![\w:])/gi;

export function isIPv6(s: string): boolean {
  if (!/^[0-9a-f:]+$/i.test(s) || s.length < 2) return false;
  const dbl = s.split("::");
  if (dbl.length > 2) return false;
  const parts = (x: string) => (x === "" ? [] : x.split(":"));
  const groups = [...parts(dbl[0]), ...(dbl.length === 2 ? parts(dbl[1]) : [])];
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return false;
  return dbl.length === 2 ? groups.length <= 7 : groups.length === 8;
}

/** Shortest IPv6 form (RFC 5952): lower case, leading zeros removed, the longest zero run as ::. */
export function compressIPv6(s: string): string {
  const [a, b] = s.toLowerCase().split("::");
  const left = a ? a.split(":") : [];
  const right = b !== undefined && b !== "" ? b.split(":") : [];
  const groups = b === undefined ? left : [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
  const g = groups.map((x) => x.replace(/^0+(?=.)/, ""));
  let best = -1;
  let bestLen = 1;
  for (let i = 0; i < 8; ) {
    if (g[i] !== "0") {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && g[j] === "0") j++;
    if (j - i > bestLen) {
      best = i;
      bestLen = j - i;
    }
    i = j;
  }
  if (best < 0) return g.join(":");
  return `${g.slice(0, best).join(":")}::${g.slice(best + bestLen).join(":")}`;
}

export function ips(text: string): { v4: Hit[]; v6: Hit[] } {
  const v4 = all(IPV4, text, (m) => ({ value: m[0], normalized: m[0], key: m[0], index: m.index }));
  const v6 = all(IPV6_CANDIDATE, text, (m) => {
    if (!isIPv6(m[0]) || !m[0].includes(":") || /^\d+:\d+(:\d+)?$/.test(m[0])) return null;
    const n = compressIPv6(m[0]);
    return { value: m[0], normalized: n, key: n, index: m.index };
  });
  return { v4, v6 };
}

// ---------------------------------------------------------------- IBAN

const IBAN = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g;
const IBAN_LENGTH: Record<string, number> = { AD: 24, AT: 20, BE: 16, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18, EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GR: 27, HR: 21, HU: 28, IE: 22, IS: 26, IT: 27, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31, NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, SE: 24, SI: 19, SK: 24, SA: 24, AE: 23, TR: 26, SM: 27, LI: 21 };

/** ISO 13616 check: move the first four characters to the end, letters to numbers, remainder mod 97 must be 1. */
export function ibanValid(iban: string): boolean {
  const s = iban.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const expected = IBAN_LENGTH[s.slice(0, 2)];
  if (expected && s.length !== expected) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

export function ibans(text: string): Hit[] {
  return all(IBAN, text, (m) => {
    const n = m[0].replace(/\s/g, "");
    if (n.length < 15) return null;
    const ok = ibanValid(n);
    return { value: m[0], normalized: n.replace(/(.{4})/g, "$1 ").trim(), key: n, index: m.index, extra: ok ? "checksum valid" : "checksum NOT valid (typo or not an IBAN)" };
  });
}

// ---------------------------------------------------------------- dates

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const MONTH_RE = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DATE_ISO = /\b(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?\b/g;
const DATE_NUMERIC = /(?<![\d/.-])(\d{1,2})([/.])(\d{1,2})\2(\d{4}|\d{2})(?![\d/.-]*\d)/g;
const DATE_DMY_WORDS = new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(${MONTH_RE})\.?,?\s+(\d{4})\b`, "gi");
const DATE_MDY_WORDS = new RegExp(String.raw`\b(${MONTH_RE})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b`, "gi");

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1) return null;
  if (d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function dates(text: string, dayFirst: boolean): Hit[] {
  const out: Hit[] = [];
  append(
    out,
    all(DATE_ISO, text, (m) => {
      const d = iso(+m[1], +m[2], +m[3]);
      if (!d) return null;
      const time = m[4] ? `T${m[4]}:${m[5]}${m[6] ? `:${m[6]}` : ""}${m[7] ?? ""}` : "";
      return { value: m[0], normalized: d + time, key: d + time, index: m.index };
    }),
  );
  append(
    out,
    all(DATE_NUMERIC, text, (m) => {
      let y = +m[4];
      if (m[4].length === 2) y += y < 70 ? 2000 : 1900;
      const a = +m[1];
      const b = +m[3];
      // A day above 12 settles the order; otherwise the visitor's choice does.
      const [d, mo] = a > 12 ? [a, b] : b > 12 ? [b, a] : dayFirst ? [a, b] : [b, a];
      const n = iso(y, mo, d);
      if (!n) return null;
      const ambiguous = a <= 12 && b <= 12 && a !== b;
      return { value: m[0], normalized: n, key: n, index: m.index, extra: ambiguous ? `read as ${dayFirst ? "day/month" : "month/day"}` : undefined };
    }),
  );
  append(
    out,
    all(DATE_DMY_WORDS, text, (m) => {
      const n = iso(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
      return n ? { value: m[0], normalized: n, key: n, index: m.index } : null;
    }),
  );
  append(
    out,
    all(DATE_MDY_WORDS, text, (m) => {
      const n = iso(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
      return n ? { value: m[0], normalized: n, key: n, index: m.index } : null;
    }),
  );
  return out.sort((x, y) => x.index - y.index);
}

// ---------------------------------------------------------------- money

const SYMBOLS: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₹": "INR", "₩": "KRW", "₽": "RUB", "₺": "TRY", "₪": "ILS", "R$": "BRL", "US$": "USD", "A$": "AUD", "C$": "CAD", "CHF": "CHF", "Fr.": "CHF", "kr": "SEK" };
const CODES = "USD|EUR|GBP|JPY|CHF|CAD|AUD|NZD|INR|CNY|SEK|NOK|DKK|PLN|CZK|HUF|BRL|MXN|ZAR|SGD|HKD|KRW|TRY|ILS|AED|SAR|RUB";
const NUM = String.raw`\d{1,3}(?:[,.\s  ']\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const MONEY_BEFORE = new RegExp(String.raw`(?<![\w$€£¥₹-])(-?)(US\$|A\$|C\$|R\$|[$€£¥₹₩₽₺₪]|(?:${CODES})\s?)\s?(-?)(${NUM})(?:\s?(k|m|bn|million|billion))?(?![\d\w])`, "gi");
const MONEY_AFTER = new RegExp(String.raw`(?<![\w.,])(-?)(${NUM})\s?([€£¥₹]|(?:${CODES})\b|kr\b)`, "gi");

/** "1.234,56" → 1234.56 and "1,234.56" → 1234.56: the last separator followed by 1–2 digits is the decimal mark. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/[\s  ']/g, "");
  const m = /^(.*?)([.,])(\d{1,2})$/.exec(s);
  const intPart = (m ? m[1] : s).replace(/[.,]/g, "");
  if (!/^\d+$/.test(intPart)) return null;
  return Number(m ? `${intPart}.${m[3]}` : intPart);
}

export function amounts(text: string): Hit[] {
  const out: Hit[] = [];
  const mult: Record<string, number> = { k: 1e3, m: 1e6, bn: 1e9, million: 1e6, billion: 1e9 };
  const make = (m: RegExpExecArray, cur: string, sign: string, num: string, scale?: string): Hit | null => {
    const v = parseAmount(num);
    if (v === null) return null;
    const code = SYMBOLS[cur.trim()] ?? cur.trim().toUpperCase();
    const value = (sign ? -1 : 1) * v * (scale ? mult[scale.toLowerCase()] : 1);
    const normalized = `${code} ${value.toFixed(code === "JPY" || code === "KRW" ? 0 : 2)}`;
    return { value: m[0].trim(), normalized, key: normalized, index: m.index };
  };
  append(out, all(MONEY_BEFORE, text, (m) => make(m, m[2], m[1] || m[3], m[4], m[5])));
  const taken = new Set(out.map((h) => h.index));
  append(out, all(MONEY_AFTER, text, (m) => (taken.has(m.index) ? null : make(m, m[3], m[1], m[2]))));
  return out.sort((a, b) => a.index - b.index);
}

// ---------------------------------------------------------------- phones

// Candidates: digit runs with common separators; libphonenumber then decides.
const PHONE_CANDIDATE = /(?<![\w+.\-/])(?:\+|00)?\d{1,4}(?:[\s.\-]?(?:\(\d{1,5}\)|\d{1,5})){1,6}(?:\s?(?:ext\.?|x)\s?\d{1,5})?(?![\w.\-/]*\d)|(?<![\w+])\(\d{2,5}\)[\s.\-]?\d{2,5}(?:[\s.\-]?\d{2,5}){1,3}/gi;

export function phones(text: string, country: string): Hit[] {
  return all(PHONE_CANDIDATE, text, (m) => {
    const raw = m[0].trim();
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return null;
    const p = parsePhoneNumberFromString(raw.replace(/^00/, "+"), country as CountryCode);
    if (!p || !p.isPossible()) return null;
    return { value: raw, normalized: p.number, key: p.number, index: m.index, extra: `${p.country ?? "?"} · ${p.formatInternational()}${p.isValid() ? "" : " · not a valid number for that country"}` };
  });
}

// ---------------------------------------------------------------- hashtags and mentions

// "#A-1042" is an order number, not a tag, so a tag may not continue with a hyphen.
const HASHTAG = /(?<![\p{L}\p{N}_&#/])#([\p{L}\p{N}_]*\p{L}[\p{L}\p{N}_]*)(?![-\p{L}\p{N}_])/gu;
const MENTION = /(?<![\p{L}\p{N}_.@/])@([A-Za-z0-9_](?:[A-Za-z0-9_.]{0,38}[A-Za-z0-9_])?)(?![\p{L}\p{N}_@]|\.[A-Za-z])/gu;

export function hashtags(text: string): Hit[] {
  return all(HASHTAG, text, (m) => ({ value: m[0], normalized: m[0], key: m[0].toLowerCase(), index: m.index }));
}

export function mentions(text: string): Hit[] {
  return all(MENTION, text, (m) => ({ value: m[0], normalized: m[0], key: m[0].toLowerCase(), index: m.index }));
}

// ---------------------------------------------------------------- all together

function group(hits: Hit[], text: string, dedupe: boolean): Entity[] {
  const map = new Map<string, Entity>();
  const out: Entity[] = [];
  for (const h of hits) {
    const ctx = text.slice(Math.max(0, h.index - 30), h.index + h.value.length + 30).replace(/\s+/g, " ");
    if (dedupe) {
      const e = map.get(h.key);
      if (e) {
        e.count++;
        continue;
      }
    }
    const e: Entity = { value: h.value, normalized: h.normalized, count: 1, index: h.index, context: ctx, note: h.extra ?? null };
    if (dedupe) map.set(h.key, e);
    out.push(e);
  }
  return out;
}

/**
 * Extracts every category. Spans already claimed (emails, URLs, IBANs, IPs,
 * dates, amounts) are blanked before phone numbers are searched, so a date
 * or an IP is not also reported as a phone number.
 */
export function extractAll(text: string, o: Options, onStep?: (label: string, fraction: number) => void): Record<Category, Entity[]> {
  const step = (l: string, f: number) => onStep?.(l, f);
  step("Emails", 0.05);
  const em = emails(text);
  let masked = mask(text, em.map((h) => ({ index: h.index, length: h.value.length })));
  step("URLs", 0.15);
  const ur = urls(masked);
  masked = mask(masked, ur.map((h) => ({ index: h.index, length: h.value.length })));
  step("IBANs and IP addresses", 0.3);
  const ib = ibans(masked);
  const ip = ips(masked);
  step("Dates and amounts", 0.45);
  const da = dates(masked, o.dayFirst);
  const am = amounts(masked);
  masked = mask(masked, [...ib, ...ip.v4, ...ip.v6, ...da, ...am].map((h) => ({ index: h.index, length: h.value.length })));
  step("Phone numbers", 0.6);
  const ph = phones(masked, o.country);
  step("Hashtags and mentions", 0.9);
  const ht = hashtags(masked);
  const me = mentions(masked);
  return {
    email: group(em, text, o.dedupe),
    url: group(ur, text, o.dedupe),
    phone: group(ph, text, o.dedupe),
    date: group(da, text, o.dedupe),
    amount: group(am, text, o.dedupe),
    hashtag: group(ht, text, o.dedupe),
    mention: group(me, text, o.dedupe),
    ipv4: group(ip.v4, text, o.dedupe),
    ipv6: group(ip.v6, text, o.dedupe),
    iban: group(ib, text, o.dedupe),
  };
}

/** The visitor's own pattern, run in a separate worker with a time limit. */
export function customMatches(text: string, source: string, flags: string, dedupe: boolean, ignoreCase: boolean): Entity[] {
  const re = new RegExp(source, flags.includes("g") ? flags : `${flags}g`);
  const hits = all(re, text, (m) => (m[0] === "" ? null : { value: m[0], normalized: m[0], key: ignoreCase ? m[0].toLowerCase() : m[0], index: m.index }));
  return group(hits.slice(0, 100_000), text, dedupe);
}
