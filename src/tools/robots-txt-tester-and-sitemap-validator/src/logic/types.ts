import type { Issue, ParsedRobots, Verdict } from "./robots";

// Result types shared by the route and the page; robots.ts has no imports, so this file stays browser-safe.

export interface RobotsReport {
  url: string;
  finalUrl: string | null;
  status: number | null;
  /** "found": parsed; "missing": 4xx, everything allowed; "error": 5xx or unreachable, crawlers back off. */
  state: "found" | "missing" | "error";
  message: string;
  contentType: string | null;
  bytes: number;
  truncated: boolean;
  /** The file as read (at most 500 KiB), so the page can test more URLs without asking the server again. */
  text: string;
  parsed: ParsedRobots;
}

export interface SitemapReport {
  url: string;
  /** Why it was checked: listed in robots.txt, the default /sitemap.xml, or a child of an index. */
  source: "robots" | "default" | "index";
  parent: string | null;
  status: number | null;
  finalUrl: string | null;
  contentType: string | null;
  /** Bytes downloaded (compressed size for .gz). */
  bytes: number;
  /** Size from Content-Length, when the server sent one. */
  declaredBytes: number | null;
  unpackedBytes: number | null;
  gzipped: boolean;
  kind: "urlset" | "sitemapindex" | "unknown";
  entryCount: number;
  sampleEntries: string[];
  children: string[];
  lastmod: { valid: number; invalid: number; missing: number; future: number; invalidExamples: string[]; newest: string | null };
  duplicates: number;
  offHost: number;
  partial: boolean;
  /** Entries that robots.txt blocks for Googlebot. */
  blockedForGooglebot: number;
  blockedExamples: string[];
  issues: Issue[];
}

export interface TestResult extends Verdict {
  url: string;
  userAgent: string;
}

export interface CheckData {
  origin: string;
  robots: RobotsReport;
  sitemaps: SitemapReport[];
  notChecked: { url: string; reason: string }[];
  tests: TestResult[];
}
