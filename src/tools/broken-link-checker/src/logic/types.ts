// No imports: shared by the page (browser) and the route (server).

export const LIMITS = {
  maxDepth: 2,
  maxPages: 50,
  maxLinks: 300,
  minGapMs: 250,
  concurrency: 4,
  ceilingMs: 90_000,
  pageBytes: 1_000_000,
  queryVariants: 3,
} as const;
export const RATE_LIMIT = { bucket: "broken-link-checker", limit: 3, windowSec: 600 };
export const USER_AGENT = "PerkTonicBot/1.0 (+https://perktonic.com/tools)";
export const MAX_URL_LENGTH = 2048;

export interface Options {
  depth: number;
  maxPages: number;
  checkExternal: boolean;
  checkImages: boolean;
}
export const DEFAULT_OPTIONS: Options = { depth: 2, maxPages: 50, checkExternal: true, checkImages: true };

export type Category = "ok" | "broken" | "redirect" | "unknown" | "skipped";

export interface Source {
  page: string;
  text: string;
}

export interface Item {
  url: string;
  kind: "page" | "link" | "image";
  internal: boolean;
  status: number | null;
  /** In words, for errors without a status: "No answer within 10 s", "Could not connect"… */
  error: string | null;
  redirectTo: string | null;
  category: Category;
  sources: Source[];
  sourceCount: number;
}

export type StopReason = "time" | "links" | "cancelled" | null;

export interface CrawlResult {
  start: string;
  origin: string;
  robots: { url: string; status: "found" | "none" | "unreachable" | "error"; crawlDelayMs: number | null };
  stoppedEarly: StopReason;
  pagesCrawled: number;
  linksChecked: number;
  broken: Item[];
  redirects: Item[];
  missingImages: Item[];
  unknown: Item[];
  skipped: { robots: number; queryVariants: number; external: number; images: number; overLimit: number; pageLimit: number; depth: number; schemes: number };
  okCount: number;
  durationMs: number;
  options: Options;
}

export type CrawlEvent =
  | { type: "progress"; pages: number; checked: number; queued: number; problems: number; current: string | null; elapsedMs: number }
  | { type: "done"; data: CrawlResult }
  | { type: "error"; code: string; message: string };
