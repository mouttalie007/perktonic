import { MAX_FILE_BYTES, MAX_URL_LENGTH, MAX_URLS } from "./limits";

export interface ListItem {
  /** 1-based line in the input. */
  line: number;
  raw: string;
  /** The URL that will be checked, or null when the line is skipped. */
  url: string | null;
  note: string | null;
  skip: "invalid" | "duplicate" | "over_limit" | null;
}

export interface ParsedList {
  items: ListItem[];
  urls: string[];
  /** How the input was read, e.g. "CSV with a header, column “Address”". */
  format: string;
}

const URL_HEADER = /^(url|urls|link|links|address|addresses|loc|location|page|page url|source|source url|old url|new url|href|target)$/i;

/** Splits one CSV line, honouring double quotes. */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === "\"" && line[i + 1] === "\"") {
        cur += "\"";
        i++;
      } else if (c === "\"") quoted = false;
      else cur += c;
    } else if (c === "\"" && cur.trim() === "") {
      quoted = true;
      cur = "";
    } else if (c === delimiter) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function detectDelimiter(lines: string[]): string | null {
  const sample = lines.slice(0, 20);
  for (const d of [",", ";", "\t"]) {
    // A comma inside a URL is rare but possible, so a delimiter must appear on most lines.
    const hits = sample.filter((l) => splitCsvLine(l, d).length > 1).length;
    if (hits >= Math.max(1, Math.ceil(sample.length * 0.6))) return d;
  }
  return null;
}

const looksLikeUrl = (s: string) => /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#]\S*)?$/i.test(s);

/** Cleans one entry: adds https:// when the scheme is missing and rejects anything that is not a plain http(s) URL. */
export function normalizeEntry(raw: string): { url: string; note: string | null } | { error: string } {
  let s = raw.trim().replace(/^<|>$/g, "");
  if (s.length > MAX_URL_LENGTH) return { error: `Longer than ${MAX_URL_LENGTH.toLocaleString("en-US")} characters.` };
  let note: string | null = null;
  if (/^\/\//.test(s)) {
    s = `https:${s}`;
    note = "https: added";
  } else if (!/^[a-z][a-z0-9+.-]*:/i.test(s) || /^[a-z0-9-]+(\.[a-z0-9-]+)+:\d+/i.test(s)) {
    if (!looksLikeUrl(s)) return { error: s.startsWith("/") ? "A path without a domain. Write the full URL, e.g. https://example.com/page." : "Not a URL." };
    s = `https://${s}`;
    note = "https:// added";
  }
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { error: "Not a valid URL." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { error: `Only http and https URLs can be checked (this one is ${u.protocol.slice(0, -1)}).` };
  if (u.username || u.password) return { error: "URLs with a user name or password are not checked." };
  if (u.port !== "") return { error: `Only the standard ports (80 and 443) can be checked, not ${u.port}.` };
  if (!u.hostname.includes(".") && u.hostname !== "localhost") return { error: "The host has no domain (e.g. example.com)." };
  if (/\s/.test(s)) return { error: "Contains spaces; encode them as %20." };
  return { url: u.toString(), note };
}

/** Key for spotting duplicates: same URL except for case in the host, a default port or a #fragment. */
export function dedupeKey(url: string): string {
  const u = new URL(url);
  u.hash = "";
  return u.toString();
}

/**
 * Reads a pasted list or an uploaded .txt/.csv: one URL per line, or a CSV
 * with or without a header (the URL column is found by its name or its content).
 */
export function parseList(text: string): ParsedList {
  const lines = text.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  const nonEmpty = lines.filter((l) => l.trim() !== "" && !l.trim().startsWith("#"));
  const delimiter = detectDelimiter(nonEmpty);
  let column = 0;
  let headerLine = -1;
  let format = "One URL per line";
  if (delimiter) {
    const firstIdx = lines.findIndex((l) => l.trim() !== "" && !l.trim().startsWith("#"));
    const first = splitCsvLine(lines[firstIdx], delimiter);
    const named = first.findIndex((c) => URL_HEADER.test(c.replace(/^"|"$/g, "").trim()));
    const delimName = delimiter === "\t" ? "tab" : delimiter === ";" ? "semicolon" : "comma";
    if (named >= 0 || !first.some(looksLikeUrl)) {
      headerLine = firstIdx;
      column = named >= 0 ? named : 0;
      if (named < 0) {
        // No URL-like header name: pick the column whose values look like URLs.
        const rows = lines.slice(firstIdx + 1).filter((l) => l.trim() !== "").slice(0, 20).map((l) => splitCsvLine(l, delimiter));
        const scores = first.map((_, i) => rows.filter((r) => looksLikeUrl(r[i] ?? "")).length);
        column = scores.indexOf(Math.max(...scores));
      }
      format = `CSV (${delimName}-separated) with a header, column “${first[column] || column + 1}”`;
    } else {
      column = first.findIndex(looksLikeUrl);
      format = `CSV (${delimName}-separated) without a header, column ${column + 1}`;
    }
  }

  const items: ListItem[] = [];
  const seen = new Map<string, number>();
  const urls: string[] = [];
  lines.forEach((line, i) => {
    if (i === headerLine) return;
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) return;
    const raw = delimiter ? (splitCsvLine(line, delimiter)[column] ?? "") : trimmed;
    const item: ListItem = { line: i + 1, raw: raw || trimmed, url: null, note: null, skip: null };
    if (raw === "") {
      item.skip = "invalid";
      item.note = "This row has no URL in that column.";
    } else {
      const n = normalizeEntry(raw);
      if ("error" in n) {
        item.skip = "invalid";
        item.note = n.error;
      } else {
        const key = dedupeKey(n.url);
        const dup = seen.get(key);
        if (dup !== undefined) {
          item.skip = "duplicate";
          item.note = `Duplicate of line ${dup}.`;
        } else if (urls.length >= MAX_URLS) {
          item.skip = "over_limit";
          item.note = `Not checked: the limit is ${MAX_URLS} URLs per check.`;
        } else {
          seen.set(key, i + 1);
          item.url = n.url;
          item.note = n.note;
          urls.push(n.url);
        }
      }
    }
    items.push(item);
  });
  return { items, urls, format };
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Size and magic-byte check for an uploaded list; `head` is its first bytes. */
export function checkListFile(head: Uint8Array, size: number, name: string): string | null {
  if (size === 0) return "This file is empty.";
  if (size > MAX_FILE_BYTES) return `This file is ${(size / 1048576).toFixed(1)} MB; the limit is 1 MB (far more than ${MAX_URLS} URLs).`;
  const starts = (sig: number[]) => sig.every((b, i) => head[i] === b);
  if (starts([0x50, 0x4b, 0x03, 0x04])) return /\.xlsx?$/i.test(name) ? "This is an Excel file. Save it as CSV first (File → Save As → CSV)." : "This is a ZIP or Office file, not a text list.";
  if (starts([0xd0, 0xcf, 0x11, 0xe0])) return "This is an old Excel or Word file. Save it as CSV first.";
  if (starts([0x25, 0x50, 0x44, 0x46])) return "This is a PDF, not a text list.";
  if (starts([0x1f, 0x8b])) return "This file is gzip-compressed. Decompress it first.";
  if (head.includes(0)) return "This file contains binary data, so it is not a .txt or .csv list.";
  return null;
}
