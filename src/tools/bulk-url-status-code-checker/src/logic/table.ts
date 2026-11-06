import { statusGroup, type StatusGroup } from "./status";
import type { CheckResult } from "./types";

export type Filter = "all" | StatusGroup | "redirected";
export type SortKey = "index" | "url" | "status" | "finalUrl" | "redirects" | "timeMs" | "contentType";

export interface Row extends CheckResult {
  /** Position in the original list, 1-based. */
  index: number;
}

export function filterRows(rows: Row[], filter: Filter, query: string): Row[] {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => {
    if (filter === "redirected" ? r.redirects === 0 && !(r.status !== null && r.status >= 300 && r.status < 400) : filter !== "all" && statusGroup(r.status) !== filter) return false;
    return q === "" || r.url.toLowerCase().includes(q) || (r.finalUrl ?? "").toLowerCase().includes(q) || String(r.status ?? "").includes(q) || (r.contentType ?? "").includes(q);
  });
}

export function sortRows(rows: Row[], key: SortKey, dir: "asc" | "desc"): Row[] {
  const sign = dir === "asc" ? 1 : -1;
  const value = (r: Row): string | number => {
    const v = r[key];
    // Rows without a status (errors) sort after every real status.
    if (key === "status") return r.status ?? 1000;
    return typeof v === "number" ? v : String(v ?? "").toLowerCase();
  };
  return [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return c * sign || a.index - b.index;
  });
}

export function counts(rows: Row[]): Record<Filter, number> {
  const c: Record<Filter, number> = { all: rows.length, "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, error: 0, redirected: 0 };
  for (const r of rows) {
    c[statusGroup(r.status)]++;
    if (r.redirects > 0 || (r.status !== null && r.status >= 300 && r.status < 400)) c.redirected++;
  }
  return c;
}

const HEAD = ["#", "URL", "Status", "Status text", "Final URL", "Redirects", "Redirect chain", "Time (ms)", "Content type", "Method", "Problem"];

const cells = (r: Row): (string | number)[] => [r.index, r.url, r.status ?? "", r.statusText, r.finalUrl ?? "", r.redirects, r.chain.join(" > "), r.timeMs, r.contentType ?? "", r.method, r.error?.message ?? ""];

/** Spreadsheet apps run cells that start with = + - @ as formulas; a leading ' keeps them as text. */
function guard(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/** CSV for Excel and Google Sheets: UTF-8 with a BOM, CRLF line endings, RFC 4180 quoting. */
export function toCsv(rows: Row[]): string {
  const esc = (v: string | number) => {
    const s = typeof v === "number" ? String(v) : guard(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, "\"\"")}"` : s;
  };
  return "﻿" + [HEAD, ...rows.map(cells)].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}

/** Tab-separated text for pasting straight into a spreadsheet. */
export function toTsv(rows: Row[]): string {
  return [HEAD, ...rows.map(cells)].map((r) => r.map((v) => (typeof v === "number" ? String(v) : guard(v).replace(/[\t\r\n]+/g, " "))).join("\t")).join("\n");
}
