import { fetchText, FetchProblem, type Fetcher } from "./fetchText";
import { CHECK_BUDGET_MS, MAX_SITEMAP_FILES, SITEMAP_MAX_BYTES } from "./limits";
import { parseRobots, ROBOTS_MAX_BYTES, testPath, type Issue } from "./robots";
import { analyzeSitemap, GOOGLE_MAX_BYTES, registrableDomain } from "./sitemap";
import type { CheckData, RobotsReport, SitemapReport, TestResult } from "./types";

export interface Input {
  origin: string;
  urls: string[];
  userAgents: string[];
}

export interface Deps {
  fetcher: Fetcher;
  now?: () => number;
}

/** "example.com", "https://example.com/blog" or "http://example.com:80" → the site's origin. */
export function siteOrigin(input: string): { ok: true; origin: string } | { ok: false; error: string } {
  let s = input.trim();
  if (s === "") return { ok: false, error: "Enter a domain, for example example.com." };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { ok: false, error: "That does not look like a domain or URL." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, error: "Only http and https sites can be checked." };
  if (u.username || u.password) return { ok: false, error: "Remove the user name and password from the URL." };
  if (u.port) return { ok: false, error: "Only the standard ports (80 and 443) can be checked." };
  if (!u.hostname.includes(".")) return { ok: false, error: "Enter a full domain such as example.com." };
  return { ok: true, origin: u.origin };
}

async function checkRobots(origin: string, fetcher: Fetcher): Promise<RobotsReport> {
  const url = `${origin}/robots.txt`;
  const base = { url, finalUrl: null, status: null, contentType: null, bytes: 0, truncated: false, text: "", parsed: parseRobots("") };
  let f;
  try {
    f = await fetchText(url, ROBOTS_MAX_BYTES, fetcher);
  } catch (e) {
    const msg = e instanceof FetchProblem ? e.message : "The file could not be fetched.";
    return { ...base, state: "error", message: `${msg} While robots.txt cannot be fetched, Google may pause crawling the site.` };
  }
  const common = { ...base, finalUrl: f.finalUrl, status: f.status, contentType: f.contentType, bytes: f.bytes, truncated: f.truncated };
  if (f.status === 429 || f.status >= 500) {
    return { ...common, state: "error", message: `The server answered ${f.status}. Google treats this as “disallow everything” and pauses crawling until robots.txt answers again (after 30 days it uses the last good copy or allows everything).` };
  }
  if (f.status >= 400) {
    return { ...common, state: "missing", message: `No robots.txt (HTTP ${f.status}). Crawlers treat a missing file as “everything is allowed”.` };
  }
  if (f.status < 200 || f.status >= 300) return { ...common, state: "error", message: `Unexpected HTTP status ${f.status}.` };
  const parsed = parseRobots(f.text);
  const extra: Issue[] = [];
  if (f.truncated) extra.push({ severity: "warning", line: null, message: "The file is larger than 500 KiB. Google reads only the first 500 KiB and ignores the rest." });
  if (f.contentType && f.contentType !== "text/plain") extra.push({ severity: f.contentType === "text/html" ? "warning" : "info", line: null, message: `Served as ${f.contentType}; robots.txt should be text/plain.` });
  if (new URL(f.finalUrl).host !== new URL(url).host) extra.push({ severity: "info", line: null, message: `robots.txt redirects to ${f.finalUrl}; crawlers follow the redirect and use that file for ${new URL(url).host}.` });
  parsed.issues.unshift(...extra);
  const groups = parsed.groups.length;
  return { ...common, state: "found", text: f.text, parsed, message: `Found: ${groups} group${groups === 1 ? "" : "s"}, ${parsed.groups.reduce((n, g) => n + g.rules.length, 0)} rules, ${parsed.sitemaps.length} sitemap${parsed.sitemaps.length === 1 ? "" : "s"} listed.` };
}

/**
 * Checks robots.txt, then up to MAX_SITEMAP_FILES sitemaps: the ones listed in
 * robots.txt plus /sitemap.xml, and the children of a sitemap index (one level).
 */
export async function run(input: Input, deps: Deps): Promise<CheckData> {
  const now = deps.now ?? (() => Date.now());
  const started = now();
  const robots = await checkRobots(input.origin, deps.fetcher);
  const siteDomain = registrableDomain(new URL(input.origin).hostname);
  const notChecked: { url: string; reason: string }[] = [];
  const queue: { url: string; source: SitemapReport["source"]; parent: string | null; depth: number }[] = [];
  const queued = new Set<string>();
  const enqueue = (url: string, source: SitemapReport["source"], parent: string | null, depth: number) => {
    if (queued.has(url)) return;
    queued.add(url);
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      notChecked.push({ url, reason: "Not a valid URL." });
      return;
    }
    if (registrableDomain(host) !== siteDomain) {
      notChecked.push({ url, reason: `On another domain (${host}); only sitemaps on ${siteDomain} are fetched.` });
      return;
    }
    queue.push({ url, source, parent, depth });
  };
  for (const s of robots.parsed.sitemaps) enqueue(s.url, "robots", null, 0);
  enqueue(`${input.origin}/sitemap.xml`, "default", null, 0);

  const sitemaps: SitemapReport[] = [];
  while (queue.length) {
    const item = queue.shift()!;
    if (sitemaps.length >= MAX_SITEMAP_FILES) {
      notChecked.push({ url: item.url, reason: `Not fetched: the limit is ${MAX_SITEMAP_FILES} sitemap files per check.` });
      continue;
    }
    if (now() - started > CHECK_BUDGET_MS) {
      notChecked.push({ url: item.url, reason: "Not fetched: the check ran out of time. Check this sitemap on its own." });
      continue;
    }
    const report: SitemapReport = { url: item.url, source: item.source, parent: item.parent, status: null, finalUrl: null, contentType: null, bytes: 0, declaredBytes: null, unpackedBytes: null, gzipped: false, kind: "unknown", entryCount: 0, sampleEntries: [], children: [], lastmod: { valid: 0, invalid: 0, missing: 0, future: 0, invalidExamples: [], newest: null }, duplicates: 0, offHost: 0, partial: false, blockedForGooglebot: 0, blockedExamples: [], issues: [] };
    sitemaps.push(report);
    let f;
    try {
      f = await fetchText(item.url, SITEMAP_MAX_BYTES, deps.fetcher);
    } catch (e) {
      report.issues.push({ severity: "error", line: null, message: e instanceof FetchProblem ? e.message : "The file could not be fetched." });
      continue;
    }
    Object.assign(report, { status: f.status, finalUrl: f.finalUrl, contentType: f.contentType, bytes: f.bytes, declaredBytes: f.declaredBytes, unpackedBytes: f.unpackedBytes, gzipped: f.gzipped });
    if (f.status !== 200) {
      // The default /sitemap.xml is only a guess, so its absence is not an error.
      report.issues.push(item.source === "default" && f.status === 404 ? { severity: "info", line: null, message: "There is no /sitemap.xml. That is fine if your sitemaps live elsewhere and are listed in robots.txt or submitted in Search Console." } : { severity: "error", line: null, message: `HTTP ${f.status}: search engines cannot read this sitemap.` });
      continue;
    }
    const content = analyzeSitemap(f.text, f.finalUrl, now(), f.truncated);
    Object.assign(report, { kind: content.kind, entryCount: content.locs.length, sampleEntries: content.locs.slice(0, 5), lastmod: content.lastmod, duplicates: content.duplicates, offHost: content.offHost, partial: content.partial });
    report.issues.push(...content.issues);
    const size = f.unpackedBytes ?? f.declaredBytes ?? f.bytes;
    if (size > GOOGLE_MAX_BYTES) report.issues.push({ severity: "error", line: null, message: `The file is ${(size / 1048576).toFixed(1)} MB uncompressed; Google reads at most 50 MB per sitemap.` });
    if (f.truncated && f.declaredBytes) report.issues.push({ severity: "info", line: null, message: `The server reports ${(f.declaredBytes / 1048576).toFixed(1)} MB for this file.` });
    if (f.contentType && !/xml|gzip|text\/plain/.test(f.contentType)) report.issues.push({ severity: "warning", line: null, message: `Served as ${f.contentType}; sitemaps should be application/xml (or application/gzip for .gz).` });
    if (content.kind === "sitemapindex") {
      report.children = content.locs;
      for (const child of content.locs) {
        if (item.depth >= 1) {
          if (!queued.has(child)) notChecked.push({ url: child, reason: "Listed in a nested sitemap index; indexes cannot contain other indexes, and only one level is followed." });
          continue;
        }
        enqueue(child, "index", item.url, item.depth + 1);
      }
      if (item.depth >= 1) report.issues.push({ severity: "error", line: null, message: "This sitemap index is listed inside another index. Sitemap indexes cannot be nested." });
    } else if (robots.state === "found") {
      for (const loc of content.locs) {
        if (!testPath(robots.parsed, loc, "Googlebot").allowed) {
          report.blockedForGooglebot++;
          if (report.blockedExamples.length < 5) report.blockedExamples.push(loc);
        }
      }
      if (report.blockedForGooglebot) report.issues.push({ severity: "warning", line: null, message: `${report.blockedForGooglebot.toLocaleString("en-US")} URL${report.blockedForGooglebot === 1 ? " in this sitemap is" : "s in this sitemap are"} blocked for Googlebot by robots.txt. A sitemap should list only pages you want crawled.` });
    }
    if (report.issues.every((i) => i.severity !== "error" && i.severity !== "warning")) report.issues.push({ severity: "info", line: null, message: `Valid ${content.kind === "sitemapindex" ? "sitemap index" : "sitemap"}: ${content.locs.length.toLocaleString("en-US")} ${content.kind === "sitemapindex" ? "sitemaps" : "URLs"}.` });
  }

  const tests: TestResult[] = [];
  for (const raw of input.urls) {
    for (const ua of input.userAgents) {
      const verdict = robots.state === "found" ? testPath(robots.parsed, raw, ua) : robots.state === "missing" ? { allowed: true, rule: null, group: null, explanation: "There is no robots.txt, so everything is allowed." } : { allowed: false, rule: null, group: null, explanation: "robots.txt could not be fetched, so Google treats the whole site as blocked for now." };
      tests.push({ url: raw, userAgent: ua, ...verdict });
    }
  }
  return { origin: input.origin, robots, sitemaps, notChecked, tests };
}
