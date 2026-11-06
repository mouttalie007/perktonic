import type { Rec, Value } from "./tree";

/** XML 1.0 Name: a letter, _ or : first, then letters, digits, - . _ (no "xml" prefix, reserved by the standard). */
const NAME = /^[A-Za-z_À-ÖØ-öø-˿Ͱ-ͽͿ-῿‌‍⁰-↏Ⰰ-⿯、-퟿豈-﷏ﷰ-�][\w.\-·À-ÖØ-öø-ͽͿ-῿‌‍‿⁀⁰-↏Ⰰ-⿯、-퟿豈-﷏ﷰ-�]*$/;

export function xmlNameProblem(name: string): string | null {
  if (name === "") return "is empty";
  if (!NAME.test(name)) return /^[\d.-]/.test(name) ? "cannot start with a digit, a dot or a hyphen" : "may only contain letters, digits, _ - and . (no spaces or symbols)";
  if (/^xml/i.test(name)) return "cannot start with “xml”, which is reserved";
  return null;
}

/** A legal element name for a column header: "Unit Price" → Unit_Price, "2024" → _2024. */
export function toXmlName(raw: string): string {
  let s = raw.trim().replace(/[^\w.\-·À-�]+/g, "_");
  if (s === "" || /^[\d.-]/.test(s) || /^xml/i.test(s)) s = `_${s}`;
  return s;
}

export function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;").replace(/\n/g, "&#10;").replace(/\r/g, "&#13;").replace(/\t/g, "&#9;");
}

/** XML 1.0 forbids most control characters even when escaped. */
function clean(s: string): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

export interface XmlOptions {
  root: string;
  row: string;
  /** Plain values of each row as attributes instead of child elements. */
  attributes: boolean;
}

/**
 * Writes records as XML. Lists become repeated <item> children; null
 * becomes an empty element (or a missing attribute). Header names that are
 * not legal XML names are renamed, and the renames are reported.
 */
export function toXml(records: Rec[], opts: XmlOptions): { xml: string; renamed: string[] } {
  const renamed = new Map<string, string>();
  const name = (k: string) => {
    if (xmlNameProblem(k) === null) return k;
    const n = toXmlName(k);
    renamed.set(k, n);
    return n;
  };
  const out: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', `<${opts.root}>`];
  const element = (key: string, v: Value, depth: number) => {
    const pad = "  ".repeat(depth);
    const tag = name(key);
    if (v === null) out.push(`${pad}<${tag}/>`);
    else if (Array.isArray(v)) {
      if (v.length === 0) out.push(`${pad}<${tag}/>`);
      else {
        out.push(`${pad}<${tag}>`);
        for (const x of v) element("item", x, depth + 1);
        out.push(`${pad}</${tag}>`);
      }
    } else if (typeof v === "object") {
      out.push(`${pad}<${tag}>`);
      for (const [k, x] of Object.entries(v)) element(k, x, depth + 1);
      out.push(`${pad}</${tag}>`);
    } else out.push(`${pad}<${tag}>${escapeText(clean(String(v)))}</${tag}>`);
  };
  for (const rec of records) {
    const entries = Object.entries(rec);
    if (opts.attributes) {
      const attrs = entries.filter(([, v]) => v === null || typeof v !== "object");
      const kids = entries.filter(([, v]) => v !== null && typeof v === "object");
      const a = attrs.filter(([, v]) => v !== null).map(([k, v]) => ` ${name(k)}="${escapeAttr(clean(String(v)))}"`).join("");
      if (kids.length === 0) out.push(`  <${opts.row}${a}/>`);
      else {
        out.push(`  <${opts.row}${a}>`);
        for (const [k, v] of kids) element(k, v, 2);
        out.push(`  </${opts.row}>`);
      }
    } else {
      out.push(`  <${opts.row}>`);
      for (const [k, v] of entries) element(k, v, 2);
      out.push(`  </${opts.row}>`);
    }
  }
  out.push(`</${opts.root}>`, "");
  return { xml: out.join("\n"), renamed: [...renamed].map(([from, to]) => `“${from}” → <${to}>`) };
}
