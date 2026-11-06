import type { SafeFetchOptions, SafeResponse } from "@/lib/tools/safe-fetch";
import { extractLinks } from "./html";
import { ALLOW_ALL, DISALLOW_ALL, isAllowed, parseRobots, type Robots } from "./robots";
import { LIMITS, USER_AGENT, type Category, type CrawlEvent, type CrawlResult, type Item, type Options, type StopReason } from "./types";
import { hostOf, normalizeStart, originOf, pathKey, resolveLink } from "./url";

export type Fetcher = (url: string, opts?: SafeFetchOptions) => Promise<SafeResponse>;

export interface Deps {
  fetcher: Fetcher;
  /** Injected so tests run on a fake clock. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  signal?: AbortSignal;
}

export class CrawlError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

interface Target extends Item {
  depth: number;
  state: "new" | "queued" | "done";
}

interface Task {
  url: string;
  mode: "page" | "check";
}

const MAX_SOURCES = 5;

const errorText = (code: string | undefined, timeoutMs: number) =>
  code === "timeout" ? `No answer within ${Math.round(timeoutMs / 1000)} s` : code === "too_large" ? "The response was too large" : code === "too_many_redirects" ? "Too many redirects" : "Could not connect (the name may not exist, or the server refused)";

function categorize(status: number | null, location: string | null): Category {
  if (status === null) return "broken";
  if (status >= 300 && status < 400 && status !== 304 && location) return "redirect";
  if (status === 429) return "unknown";
  if (status >= 400) return "broken";
  return "ok";
}

/**
 * Crawls same-origin pages breadth-first (depth ≤ 2, ≤ 50 pages) and checks
 * every link and image found (≤ 300 URLs in total), politely: robots.txt is
 * obeyed, requests to one host are at least 250 ms apart (or the site's
 * Crawl-delay), at most 4 run at once, and everything stops after 90 s.
 */
export async function crawl(input: { url: string; options: Options }, deps: Deps, emit: (e: CrawlEvent) => void = () => {}): Promise<CrawlResult> {
  const start = normalizeStart(input.url);
  if (!start.ok) throw new CrawlError("invalid_input", start.error);
  const opts: Options = {
    depth: Math.max(0, Math.min(LIMITS.maxDepth, Math.floor(input.options.depth))),
    maxPages: Math.max(1, Math.min(LIMITS.maxPages, Math.floor(input.options.maxPages))),
    checkExternal: input.options.checkExternal,
    checkImages: input.options.checkImages,
  };
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const t0 = now();
  const deadline = t0 + LIMITS.ceilingMs;
  const origin = originOf(start.url);
  let stopped: StopReason = null;
  const stop = () => {
    if (deps.signal?.aborted) stopped = "cancelled";
    else if (now() >= deadline) stopped ??= "time";
    return stopped === "cancelled" || stopped === "time";
  };

  // Politeness: per-host slots, at least minGap apart.
  const nextSlot = new Map<string, number>();
  let gapFor = (host: string): number => (host ? LIMITS.minGapMs : LIMITS.minGapMs);
  const slot = async (url: string) => {
    const host = hostOf(url);
    const t = now();
    const at = Math.max(t, nextSlot.get(host) ?? 0);
    // A slot after the deadline will never be used: stop now instead of sleeping past the ceiling.
    if (at >= deadline) {
      stopped ??= "time";
      throw new CrawlError("stopped", "stopped");
    }
    nextSlot.set(host, at + gapFor(host));
    if (at > t) await sleep(at - t);
  };
  const request = async (url: string, o: SafeFetchOptions) => {
    await slot(url);
    if (stop()) throw new CrawlError("stopped", "stopped");
    return deps.fetcher(url, { userAgent: USER_AGENT, timeoutMs: Math.max(1000, Math.min(10_000, deadline - now())), ...o });
  };

  // robots.txt first.
  const robotsUrl = `${origin}/robots.txt`;
  let robots: Robots = ALLOW_ALL;
  let robotsStatus: CrawlResult["robots"]["status"] = "none";
  try {
    const r = await request(robotsUrl, { method: "GET", maxBytes: 512_000, headers: { accept: "text/plain" } });
    if (r.status === 200) {
      robots = parseRobots(new TextDecoder().decode(r.body));
      robotsStatus = "found";
    } else if (r.status >= 500) {
      // RFC 9309: a server error on robots.txt means "assume everything is disallowed".
      robots = DISALLOW_ALL;
      robotsStatus = "error";
    }
  } catch (e) {
    if (e instanceof CrawlError) throw e;
    robots = DISALLOW_ALL;
    robotsStatus = "unreachable";
  }
  if (robots.crawlDelayMs !== null) {
    const ownHost = hostOf(start.url);
    const delay = Math.max(LIMITS.minGapMs, robots.crawlDelayMs);
    gapFor = (host: string) => (host === ownHost ? delay : LIMITS.minGapMs);
  }
  if (robotsStatus === "unreachable" || robotsStatus === "error") {
    throw new CrawlError("robots_unavailable", `${robotsUrl} could not be read (${robotsStatus === "error" ? "the server returned an error" : "no answer"}). Following the robots.txt standard, the crawler does not continue when it cannot read the site's rules.`);
  }
  if (!isAllowed(robots, start.url)) throw new CrawlError("robots_disallowed", `The site's robots.txt does not allow crawling ${new URL(start.url).pathname}. The crawler respects that.`);

  const targets = new Map<string, Target>();
  const variants = new Map<string, Set<string>>();
  const skipped = { robots: 0, queryVariants: 0, external: 0, images: 0, overLimit: 0, pageLimit: 0, depth: 0, schemes: 0 };
  const queue: Task[] = [];
  let pagesScheduled = 0;
  let requested = 0;
  let pagesCrawled = 0;
  let current: string | null = null;

  const target = (url: string, kind: Item["kind"], depth: number): Target => {
    let t = targets.get(url);
    if (!t) {
      t = { url, kind, internal: originOf(url) === origin, status: null, error: null, redirectTo: null, category: "ok", sources: [], sourceCount: 0, depth, state: "new" };
      targets.set(url, t);
    } else if (kind === "image" && t.kind === "link") t.kind = "image";
    return t;
  };

  const schedule = (t: Target, mode: Task["mode"]) => {
    if (t.state !== "new") return;
    if (requested + queue.length >= LIMITS.maxLinks) {
      t.state = "done";
      t.category = "skipped";
      t.error = `Not checked: the limit of ${LIMITS.maxLinks} links per crawl was reached`;
      skipped.overLimit++;
      return;
    }
    t.state = "queued";
    if (mode === "page") pagesScheduled++;
    queue.push({ url: t.url, mode });
  };

  let waiters: (() => void)[] = [];
  const notify = () => {
    const w = waiters;
    waiters = [];
    for (const f of w) f();
  };
  const changed = () => new Promise<void>((r) => waiters.push(r));

  let lastEmit = 0;
  const progress = (force = false) => {
    const t = now();
    if (!force && t - lastEmit < 300) return;
    lastEmit = t;
    let problems = 0;
    for (const x of targets.values()) if (x.category === "broken" || x.category === "redirect") problems++;
    emit({ type: "progress", pages: pagesCrawled, checked: requested, queued: queue.length, problems, current, elapsedMs: t - t0 });
  };

  const discover = (pageUrl: string, html: string, depth: number) => {
    const { base, links } = extractLinks(html);
    let baseUrl = pageUrl;
    if (base) {
      const b = resolveLink(base, pageUrl);
      if (b.kind === "url") baseUrl = b.url;
    }
    for (const l of links) {
      const r = resolveLink(l.href, baseUrl);
      if (r.kind === "skip") {
        if (r.reason === "scheme") skipped.schemes++;
        continue;
      }
      const internal = originOf(r.url) === origin;
      const t = target(r.url, l.kind, depth + 1);
      t.sourceCount++;
      if (t.sources.length < MAX_SOURCES && !t.sources.some((s) => s.page === pageUrl)) t.sources.push({ page: pageUrl, text: l.text });
      if (t.state !== "new") continue;
      if (l.kind === "image" && !opts.checkImages) {
        skipped.images++;
        t.state = "done";
        t.category = "skipped";
        continue;
      }
      if (!internal && !opts.checkExternal) {
        skipped.external++;
        t.state = "done";
        t.category = "skipped";
        continue;
      }
      if (internal) {
        // Loop guard: at most N query-string variants of one path (?page=1, ?page=2…).
        const key = pathKey(r.url);
        const set = variants.get(key) ?? new Set<string>();
        const q = new URL(r.url).search;
        if (!set.has(q) && set.size >= LIMITS.queryVariants) {
          skipped.queryVariants++;
          t.state = "done";
          t.category = "skipped";
          t.error = `Not checked: more than ${LIMITS.queryVariants} query-string variants of this path`;
          continue;
        }
        set.add(q);
        variants.set(key, set);
        if (!isAllowed(robots, r.url)) {
          skipped.robots++;
          t.state = "done";
          t.category = "skipped";
          t.error = "Not checked: disallowed by robots.txt";
          continue;
        }
      }
      const crawlable = internal && l.kind === "link" && depth + 1 <= opts.depth;
      if (crawlable && pagesScheduled < opts.maxPages) schedule(t, "page");
      else {
        if (internal && l.kind === "link" && depth + 1 > opts.depth) skipped.depth++;
        else if (crawlable) skipped.pageLimit++;
        schedule(t, "check");
      }
    }
    notify();
  };

  const record = (t: Target, r: SafeResponse | null, code?: string) => {
    t.state = "done";
    if (!r) {
      t.status = null;
      t.error = errorText(code, 10_000);
      t.category = code === "blocked_host" ? "skipped" : "broken";
      if (code === "blocked_host") t.error = "Not checked: the address is on a private network";
      return;
    }
    t.status = r.status;
    const loc = r.headers["location"]?.[0];
    t.redirectTo = loc ? (() => {
      try {
        return new URL(loc, t.url).toString();
      } catch {
        return loc;
      }
    })() : null;
    t.category = categorize(r.status, t.redirectTo);
    if (r.status === 429) t.error = "The server is limiting requests (429), so the link could not be checked";
  };

  const runTask = async (task: Task) => {
    const t = targets.get(task.url)!;
    current = task.url;
    requested++;
    try {
      if (task.mode === "page") {
        const r = await request(task.url, { method: "GET", maxBytes: LIMITS.pageBytes, headers: { accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" } });
        record(t, r);
        const ct = r.headers["content-type"]?.[0] ?? "";
        if (r.status === 200 && /html/i.test(ct)) {
          pagesCrawled++;
          discover(task.url, new TextDecoder().decode(r.body), t.depth);
        } else if (t.category === "redirect" && t.redirectTo && originOf(t.redirectTo) === origin && pagesScheduled < opts.maxPages) {
          // Follow an internal redirect as a page of its own, at the same depth.
          const next = target(t.redirectTo, "page", t.depth);
          if (next.sources.length < MAX_SOURCES) next.sources.push({ page: task.url, text: "(redirect)" });
          next.sourceCount++;
          if (next.state === "new" && isAllowed(robots, next.url)) schedule(next, "page");
          notify();
        }
      } else {
        let r = await request(task.url, { method: "HEAD", maxBytes: 0 });
        // Some servers do not implement HEAD: retry with a short GET.
        if (r.status === 405 || r.status === 501) r = await request(task.url, { method: "GET", maxBytes: 16_384 });
        record(t, r);
      }
    } catch (e) {
      if (e instanceof CrawlError && e.code === "stopped") {
        t.state = "done";
        t.category = "skipped";
        t.error = stopped === "cancelled" ? "Not checked: the crawl was cancelled" : "Not checked: the 90-second limit was reached";
        requested--;
        return;
      }
      record(t, null, (e as { code?: string }).code);
    }
    progress();
  };

  const startTarget = target(start.url, "page", 0);
  startTarget.sources.push({ page: "(start)", text: "" });
  schedule(startTarget, "page");

  let active = 0;
  const worker = async () => {
    for (;;) {
      if (stop()) return;
      const task = queue.shift();
      if (!task) {
        if (active === 0) return;
        await changed();
        continue;
      }
      active++;
      try {
        await runTask(task);
      } finally {
        active--;
        notify();
      }
    }
  };
  await Promise.all(Array.from({ length: LIMITS.concurrency }, worker));
  // Whatever is still queued was not reached in time.
  for (const task of queue) {
    const t = targets.get(task.url)!;
    t.state = "done";
    t.category = "skipped";
    t.error = stopped === "cancelled" ? "Not checked: the crawl was cancelled" : "Not checked: the 90-second limit was reached";
  }
  if (!stopped && skipped.overLimit > 0) stopped = "links";

  const first = targets.get(start.url)!;
  if (first.category === "broken" && pagesCrawled === 0) {
    throw new CrawlError("start_unreachable", first.status ? `The start page answered HTTP ${first.status}, so there was nothing to crawl.` : `The start page could not be loaded: ${first.error?.toLowerCase()}.`);
  }
  progress(true);
  const items = [...targets.values()].map(({ depth, state, ...item }) => {
    void depth;
    void state;
    return item;
  });
  return {
    start: start.url,
    origin,
    robots: { url: robotsUrl, status: robotsStatus, crawlDelayMs: robots.crawlDelayMs },
    stoppedEarly: stopped,
    pagesCrawled,
    linksChecked: requested,
    broken: items.filter((i) => i.category === "broken" && i.kind !== "image"),
    redirects: items.filter((i) => i.category === "redirect"),
    missingImages: items.filter((i) => i.category === "broken" && i.kind === "image"),
    unknown: items.filter((i) => i.category === "unknown"),
    skipped,
    okCount: items.filter((i) => i.category === "ok").length,
    durationMs: now() - t0,
    options: opts,
  };
}
