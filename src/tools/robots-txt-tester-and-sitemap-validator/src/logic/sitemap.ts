import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Issue } from "./robots";

export const SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";
/** Google's limits for one sitemap file. */
export const GOOGLE_MAX_URLS = 50_000;
export const GOOGLE_MAX_BYTES = 50 * 1024 * 1024;
const CHANGEFREQ = new Set(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]);

export interface LastmodStats {
  valid: number;
  invalid: number;
  missing: number;
  future: number;
  /** Up to 5 invalid values, to show what is wrong. */
  invalidExamples: string[];
  newest: string | null;
}

export interface SitemapContent {
  kind: "urlset" | "sitemapindex" | "unknown";
  /** <loc> values in order: page URLs for a urlset, sitemap URLs for an index. */
  locs: string[];
  lastmod: LastmodStats;
  issues: Issue[];
  duplicates: number;
  /** Entries on another host than the sitemap file itself. */
  offHost: number;
  /** True when the XML was cut off by our size cap and only counted. */
  partial: boolean;
}

const W3C_DATETIME = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;

/** W3C Datetime as the sitemap protocol requires: YYYY, YYYY-MM, YYYY-MM-DD, or a date and time with a time zone. */
export function checkLastmod(value: string, now: number): "valid" | "invalid" | "future" {
  const m = W3C_DATETIME.exec(value.trim());
  if (!m) return "invalid";
  const [, y, mo, d, h, mi, s] = m;
  if (mo && (Number(mo) < 1 || Number(mo) > 12)) return "invalid";
  if (d) {
    const days = new Date(Date.UTC(Number(y), Number(mo), 0)).getUTCDate();
    if (Number(d) < 1 || Number(d) > days) return "invalid";
  }
  if (h && (Number(h) > 23 || Number(mi) > 59 || (s !== undefined && Number(s) > 59))) return "invalid";
  const t = Date.parse(d ? value.trim() : `${y}-${mo ?? "01"}-01T00:00:00Z`);
  // A day of slack covers time zones and clocks that are a little off.
  if (Number.isFinite(t) && t > now + 86_400_000) return "future";
  return "valid";
}

function lastmodHint(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(value)) return "a time needs a time zone, e.g. 2026-10-28T09:15:00+00:00";
  if (/^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}/.test(value)) return "use YYYY-MM-DD, not a local date format";
  if (/^\d{10,13}$/.test(value)) return "a Unix timestamp is not allowed; use YYYY-MM-DD";
  if (/^[A-Z][a-z]{2},/.test(value)) return "this is an HTTP date; use YYYY-MM-DD";
  return "use YYYY-MM-DD or YYYY-MM-DDThh:mm:ss+00:00";
}

const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const text = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : v && typeof v === "object" && "#text" in v ? String((v as { "#text": unknown })["#text"]) : "");

/** Strips an "ns:" prefix so <sm:urlset> and <urlset> are read the same way. */
function local(name: string): string {
  return name.includes(":") ? name.slice(name.indexOf(":") + 1) : name;
}

function child(obj: Record<string, unknown>, name: string): unknown {
  for (const k of Object.keys(obj)) if (local(k) === name) return obj[k];
  return undefined;
}

/**
 * Validates one sitemap or sitemap index. `xml` may be cut off by our size
 * cap (`truncated`), in which case URLs are only counted.
 */
export function analyzeSitemap(xml: string, fileUrl: string, now: number, truncated: boolean): SitemapContent {
  const issues: Issue[] = [];
  const lastmod: LastmodStats = { valid: 0, invalid: 0, missing: 0, future: 0, invalidExamples: [], newest: null };
  const empty = (kind: SitemapContent["kind"], partial = false): SitemapContent => ({ kind, locs: [], lastmod, issues, duplicates: 0, offHost: 0, partial });
  const body = xml.replace(/^﻿/, "");
  if (body.trim() === "") {
    issues.push({ severity: "error", line: null, message: "The file is empty." });
    return empty("unknown");
  }
  if (/^\s*<(!doctype\s+html|html)/i.test(body)) {
    issues.push({ severity: "error", line: null, message: "This is an HTML page, not a sitemap. The URL probably shows a normal page or an error page." });
    return empty("unknown");
  }
  // Sitemaps never need a DTD; refusing one also rules out entity-expansion tricks.
  if (/<!DOCTYPE|<!ENTITY/i.test(body.slice(0, 4096))) {
    issues.push({ severity: "error", line: null, message: "The file declares a DOCTYPE or entities, which sitemaps do not use; it was not parsed." });
    return empty("unknown");
  }
  if (truncated) {
    const kind = /<(\w+:)?sitemapindex[\s>]/.test(body) ? "sitemapindex" : /<(\w+:)?urlset[\s>]/.test(body) ? "urlset" : "unknown";
    const locs = [...body.matchAll(/<(?:\w+:)?loc>\s*([^<\s]+)\s*<\/(?:\w+:)?loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    issues.push({ severity: "warning", line: null, message: `The file is larger than our 2 MB limit, so only the first 2 MB were read: ${locs.length.toLocaleString("en-US")} entries counted so far, and the XML could not be fully validated.` });
    return { ...empty(kind, true), locs };
  }
  const valid = XMLValidator.validate(body, { allowBooleanAttributes: false });
  if (valid !== true) {
    const { msg, line } = valid.err;
    const hint = /entity|&/i.test(msg) || /&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(body) ? " A raw & in a URL must be written as &amp;." : "";
    issues.push({ severity: "error", line, message: `The XML is not well-formed: ${msg}${hint}` });
    return empty("unknown");
  }
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", parseTagValue: false, trimValues: true, processEntities: true, htmlEntities: false });
  const doc = parser.parse(body) as Record<string, unknown>;
  const rootName = Object.keys(doc).find((k) => !k.startsWith("?"));
  if (!rootName) {
    issues.push({ severity: "error", line: null, message: "No root element was found." });
    return empty("unknown");
  }
  const kindName = local(rootName);
  if (kindName !== "urlset" && kindName !== "sitemapindex") {
    issues.push({ severity: "error", line: null, message: `The root element is <${rootName}>; a sitemap starts with <urlset> and a sitemap index with <sitemapindex>.` });
    return empty("unknown");
  }
  const kind = kindName as "urlset" | "sitemapindex";
  const root = (doc[rootName] ?? {}) as Record<string, unknown>;
  const prefix = rootName.includes(":") ? rootName.slice(0, rootName.indexOf(":")) : null;
  const ns = (prefix ? root[`@xmlns:${prefix}`] : root["@xmlns"]) as string | undefined;
  if (ns === undefined) issues.push({ severity: "warning", line: null, message: `The <${kindName}> element has no xmlns="${SITEMAP_NS}". Google tolerates it, but the protocol requires it.` });
  else if (ns.replace(/^https:/, "http:").replace(/\/$/, "") !== SITEMAP_NS) issues.push({ severity: "warning", line: null, message: `Unexpected namespace “${ns}”; it should be ${SITEMAP_NS}.` });
  else if (ns !== SITEMAP_NS) issues.push({ severity: "info", line: null, message: `The namespace should be exactly ${SITEMAP_NS} (http, no trailing slash).` });

  const entries = asArray(child(root, kind === "urlset" ? "url" : "sitemap") as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const wrong = child(root, kind === "urlset" ? "sitemap" : "url");
  if (wrong !== undefined) issues.push({ severity: "error", line: null, message: kind === "urlset" ? "<sitemap> entries belong in a <sitemapindex>, not in a <urlset>." : "<url> entries belong in a <urlset>, not in a <sitemapindex>." });

  const fileHost = new URL(fileUrl).host.toLowerCase();
  const locs: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let offHost = 0;
  let missingLoc = 0;
  let badLoc = 0;
  let longLoc = 0;
  let badFreq = 0;
  let badPriority = 0;
  const badLocExamples: string[] = [];
  for (const e of entries) {
    const entry = (typeof e === "object" && e !== null ? e : {}) as Record<string, unknown>;
    const loc = text(child(entry, "loc")).trim();
    if (!loc) {
      missingLoc++;
      continue;
    }
    let u: URL | null = null;
    try {
      u = new URL(loc);
      if (!/^https?:$/.test(u.protocol)) u = null;
    } catch {
      u = null;
    }
    if (!u) {
      badLoc++;
      if (badLocExamples.length < 3) badLocExamples.push(loc.slice(0, 100));
      continue;
    }
    if (loc.length > 2048) longLoc++;
    if (u.host.toLowerCase() !== fileHost) offHost++;
    if (seen.has(loc)) duplicates++;
    else seen.add(loc);
    locs.push(loc);
    const lm = child(entry, "lastmod");
    if (lm === undefined) lastmod.missing++;
    else {
      const v = text(lm).trim();
      const r = checkLastmod(v, now);
      lastmod[r]++;
      if (r === "invalid" && lastmod.invalidExamples.length < 5) lastmod.invalidExamples.push(v.slice(0, 40));
      if (r !== "invalid" && (lastmod.newest === null || Date.parse(v.length <= 7 ? `${v}-01` : v) > Date.parse(lastmod.newest.length <= 7 ? `${lastmod.newest}-01` : lastmod.newest))) lastmod.newest = v;
    }
    if (kind === "urlset") {
      const cf = child(entry, "changefreq");
      if (cf !== undefined && !CHANGEFREQ.has(text(cf).trim().toLowerCase())) badFreq++;
      const pr = child(entry, "priority");
      if (pr !== undefined) {
        const p = Number(text(pr));
        if (text(pr).trim() === "" || !Number.isFinite(p) || p < 0 || p > 1) badPriority++;
      }
    }
  }
  const what = kind === "urlset" ? "URL" : "sitemap";
  if (entries.length === 0) issues.push({ severity: "warning", line: null, message: `The ${kind === "urlset" ? "sitemap" : "sitemap index"} has no entries.` });
  if (missingLoc) issues.push({ severity: "error", line: null, message: `${missingLoc} ${what} entr${missingLoc === 1 ? "y has" : "ies have"} no <loc>.` });
  if (badLoc) issues.push({ severity: "error", line: null, message: `${badLoc} <loc> value${badLoc === 1 ? " is not a" : "s are not"} full http(s) URL${badLoc === 1 ? "" : "s"}, e.g. “${badLocExamples[0]}”. Use absolute URLs such as https://example.com/page.` });
  if (longLoc) issues.push({ severity: "warning", line: null, message: `${longLoc} URL${longLoc === 1 ? " is" : "s are"} longer than 2,048 characters, which search engines may skip.` });
  if (offHost) issues.push({ severity: "warning", line: null, message: `${offHost.toLocaleString("en-US")} ${what}${offHost === 1 ? " is" : "s are"} on another host than ${fileHost}. The protocol only allows URLs from the sitemap's own host, unless robots.txt of the other host points to this sitemap.` });
  if (duplicates) issues.push({ severity: "warning", line: null, message: `${duplicates.toLocaleString("en-US")} duplicate <loc> value${duplicates === 1 ? "" : "s"}.` });
  if (badFreq) issues.push({ severity: "warning", line: null, message: `${badFreq} <changefreq> value${badFreq === 1 ? " is" : "s are"} not one of always, hourly, daily, weekly, monthly, yearly, never. (Google ignores changefreq.)` });
  if (badPriority) issues.push({ severity: "warning", line: null, message: `${badPriority} <priority> value${badPriority === 1 ? " is" : "s are"} outside 0.0–1.0. (Google ignores priority.)` });
  if (lastmod.invalid) issues.push({ severity: "warning", line: null, message: `${lastmod.invalid} <lastmod> value${lastmod.invalid === 1 ? " is" : "s are"} not in W3C Datetime format, e.g. “${lastmod.invalidExamples[0]}”: ${lastmodHint(lastmod.invalidExamples[0])}.` });
  if (lastmod.future) issues.push({ severity: "warning", line: null, message: `${lastmod.future} <lastmod> date${lastmod.future === 1 ? " is" : "s are"} in the future. Search engines may stop trusting lastmod on this site.` });
  if (locs.length > GOOGLE_MAX_URLS) issues.push({ severity: "error", line: null, message: `${locs.length.toLocaleString("en-US")} ${what}s: Google reads at most 50,000 per file. Split it and list the parts in a sitemap index.` });
  return { kind, locs, lastmod, issues, duplicates, offHost, partial: false };
}

const MULTI_PART_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "net.uk", "com.au", "net.au", "org.au", "edu.au", "gov.au", "co.nz", "org.nz", "co.jp", "ne.jp", "or.jp", "ac.jp",
  "com.br", "net.br", "org.br", "com.mx", "org.mx", "co.in", "net.in", "org.in", "co.za", "org.za", "com.tr", "com.cn", "net.cn", "org.cn", "com.sg", "com.hk", "co.kr",
  "or.kr", "com.ar", "com.tw", "co.id", "com.my", "com.ph", "com.pk", "com.eg", "com.sa", "com.ng", "co.il", "com.ua", "com.vn", "co.th", "com.co", "com.pe", "com.es",
  "co.at", "or.at", "com.pl", "com.ru", "com.de", "co.ke", "com.qa", "com.kw", "co.ae",
]);

/** example.co.uk for shop.example.co.uk. A short list of common two-part suffixes stands in for the full Public Suffix List. */
export function registrableDomain(host: string): string {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (/^\d+(\.\d+){3}$/.test(h) || h.includes(":")) return h;
  const labels = h.split(".");
  if (labels.length <= 2) return h;
  const lastTwo = labels.slice(-2).join(".");
  return MULTI_PART_SUFFIXES.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}
