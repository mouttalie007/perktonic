// No imports: used by the route and, for live URL testing, by the browser.

export type Severity = "error" | "warning" | "info";

export interface Issue {
  severity: Severity;
  message: string;
  /** 1-based line in robots.txt, when the issue belongs to one. */
  line: number | null;
}

export interface Rule {
  type: "allow" | "disallow";
  path: string;
  line: number;
}

export interface Group {
  agents: string[];
  line: number;
  rules: Rule[];
  crawlDelay: number | null;
}

export interface ParsedRobots {
  groups: Group[];
  sitemaps: { url: string; line: number }[];
  issues: Issue[];
  lines: number;
}

/** Google reads the first 500 KiB of robots.txt and ignores the rest (RFC 9309 asks for at least that much). */
export const ROBOTS_MAX_BYTES = 500 * 1024;

const TYPOS: Record<string, string> = {
  disalow: "disallow", dissallow: "disallow", dissalow: "disallow", disallaw: "disallow", "dis-allow": "disallow", disallows: "disallow",
  alow: "allow", allows: "allow",
  "user agent": "user-agent", useragent: "user-agent", "user-agents": "user-agent", "useragents": "user-agent",
  "site-map": "sitemap", sitemaps: "sitemap", "site map": "sitemap",
  "crawl delay": "crawl-delay", crawldelay: "crawl-delay",
};

const OTHER: Record<string, string> = {
  noindex: "Noindex is not supported in robots.txt (Google stopped reading it in 2019). Use a noindex meta tag or X-Robots-Tag header instead.",
  host: "Host is a Yandex-only directive; other crawlers ignore it.",
  "clean-param": "Clean-param is a Yandex-only directive; other crawlers ignore it.",
  "request-rate": "Request-rate is not part of the standard; most crawlers ignore it.",
  "visit-time": "Visit-time is not part of the standard; most crawlers ignore it.",
  nofollow: "Nofollow is not a robots.txt directive; crawlers ignore it.",
};

/** Normalizes percent-encoding so /caf%c3%a9, /café and /caf%C3%A9 compare equal (RFC 9309 section 2.2.2). */
export function normalizePath(path: string): string {
  // Fast path: plain ASCII without escapes needs no work (most rules), which keeps large files quick to test.
  if (/^[\x21-\x7e]*$/.test(path) && !path.includes("%")) return path;
  let out = "";
  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    if (c === "%" && /^[0-9a-fA-F]{2}$/.test(path.slice(i + 1, i + 3))) {
      out += `%${path.slice(i + 1, i + 3).toUpperCase()}`;
      i += 2;
    } else if (c.charCodeAt(0) > 0x7e || c.charCodeAt(0) < 0x21) {
      const cp = path.codePointAt(i)!;
      if (cp > 0xffff) i++;
      for (const b of new TextEncoder().encode(String.fromCodePoint(cp))) out += `%${b.toString(16).toUpperCase().padStart(2, "0")}`;
    } else out += c;
  }
  return out;
}

/**
 * Does `pattern` (with * and a final $) match the start of `path`? Two-pointer
 * glob matching, linear in practice and never exponential, so a hostile
 * robots.txt cannot stall the route.
 */
export function matches(pattern: string, path: string): boolean {
  let p = pattern;
  const anchored = p.endsWith("$");
  if (anchored) p = p.slice(0, -1);
  let i = 0;
  let j = 0;
  let star = -1;
  let mark = 0;
  while (j < path.length) {
    if (i < p.length && p[i] !== "*" && p[i] === path[j]) {
      i++;
      j++;
    } else if (i < p.length && p[i] === "*") {
      star = i++;
      mark = j;
    } else if (i >= p.length && !anchored) {
      return true;
    } else if (star >= 0) {
      i = star + 1;
      j = ++mark;
    } else return false;
  }
  while (i < p.length && p[i] === "*") i++;
  return i >= p.length;
}

export function parseRobots(text: string): ParsedRobots {
  const issues: Issue[] = [];
  const groups: Group[] = [];
  const sitemaps: { url: string; line: number }[] = [];
  let body = text;
  if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);
  if (/^\s*<(!doctype|html)/i.test(body)) {
    issues.push({ severity: "error", line: 1, message: "This is an HTML page, not a robots.txt file. The server probably shows a normal page for /robots.txt; crawlers will ignore it." });
  }
  const lines = body.split(/\r\n|\r|\n/);
  let current: Group | null = null;
  let lastWasAgent = false;
  lines.forEach((rawLine, idx) => {
    const n = idx + 1;
    const line = rawLine.replace(/#.*$/, "").trim();
    if (line === "") return;
    const colon = line.indexOf(":");
    if (colon < 0) {
      issues.push({ severity: "warning", line: n, message: `No colon: “${line.slice(0, 60)}” is ignored. Directives look like “Disallow: /path”.` });
      return;
    }
    let key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (TYPOS[key]) {
      issues.push({ severity: "warning", line: n, message: `“${line.slice(0, colon).trim()}” is a misspelling of “${TYPOS[key].replace(/^./, (c) => c.toUpperCase())}”. Google accepts some misspellings, other crawlers may not.` });
      key = TYPOS[key];
    }
    if (key === "user-agent") {
      if (value === "") {
        issues.push({ severity: "warning", line: n, message: "Empty User-agent line; it matches no crawler." });
        return;
      }
      if (!lastWasAgent || !current) {
        current = { agents: [], line: n, rules: [], crawlDelay: null };
        groups.push(current);
      }
      if (!/^[A-Za-z_*-]+$/.test(value)) {
        const token = /^[A-Za-z_-]+/.exec(value)?.[0];
        issues.push({ severity: "info", line: n, message: `User-agent should be a product token such as “Googlebot”. Crawlers match only ${token ? `“${token}”` : "the leading letters"} of “${value.slice(0, 60)}”.` });
      }
      current.agents.push(value);
      lastWasAgent = true;
      return;
    }
    if (key === "sitemap") {
      try {
        const u = new URL(value);
        if (!/^https?:$/.test(u.protocol)) throw new Error();
        sitemaps.push({ url: u.toString(), line: n });
      } catch {
        issues.push({ severity: "error", line: n, message: `Sitemap must be a full URL (https://…), not “${value.slice(0, 80)}”.` });
      }
      return;
    }
    if (key === "allow" || key === "disallow" || key === "crawl-delay") {
      lastWasAgent = false;
      if (!current) {
        issues.push({ severity: "error", line: n, message: `${key === "crawl-delay" ? "Crawl-delay" : key === "allow" ? "Allow" : "Disallow"} before any User-agent line is ignored. Add “User-agent: *” above it.` });
        return;
      }
      if (key === "crawl-delay") {
        const d = Number(value);
        if (value === "" || !Number.isFinite(d) || d < 0) issues.push({ severity: "warning", line: n, message: `Crawl-delay must be a number of seconds, not “${value.slice(0, 30)}”.` });
        else {
          current.crawlDelay = d;
          issues.push({ severity: "info", line: n, message: `Crawl-delay: ${d} is honoured by Bing and Yandex; Google ignores it.` });
        }
        return;
      }
      if (value === "") {
        if (key === "disallow") issues.push({ severity: "info", line: n, message: "An empty Disallow allows everything for this group." });
        else issues.push({ severity: "warning", line: n, message: "An empty Allow does nothing." });
        return;
      }
      if (!value.startsWith("/") && !value.startsWith("*")) {
        issues.push({ severity: "warning", line: n, message: `Paths should start with / or *. Crawlers read “${value.slice(0, 60)}” as given, so it probably never matches.` });
      }
      if (/^https?:\/\//i.test(value)) issues.push({ severity: "error", line: n, message: "Rules take a path (/private/), not a full URL." });
      if (value.indexOf("$") >= 0 && value.indexOf("$") !== value.length - 1) issues.push({ severity: "warning", line: n, message: "$ only means “end of URL” as the last character; elsewhere it is matched literally." });
      current.rules.push({ type: key, path: value, line: n });
      return;
    }
    lastWasAgent = false;
    const other = OTHER[key];
    issues.push({ severity: other ? "info" : "warning", line: n, message: other ?? `Unknown directive “${line.slice(0, colon).trim()}”; crawlers ignore it.` });
  });
  for (const g of groups) {
    if (g.rules.length === 0 && g.crawlDelay === null) issues.push({ severity: "info", line: g.line, message: `The group for ${g.agents.join(", ")} has no rules, so those crawlers may fetch everything.` });
  }
  const star = groups.filter((g) => g.agents.includes("*"));
  if (star.some((g) => g.rules.some((r) => r.type === "disallow" && r.path === "/")) && !star.some((g) => g.rules.some((r) => r.type === "allow"))) {
    issues.push({ severity: "warning", line: star[0].line, message: "“User-agent: *” with “Disallow: /” blocks the whole site for every crawler without its own group." });
  }
  return { groups, sitemaps, issues, lines: lines.length };
}

/** Product token of a crawler name: "Googlebot/2.1 (+http://…)" → "googlebot". */
export function productToken(userAgent: string): string {
  return (/^[A-Za-z_-]+/.exec(userAgent.trim())?.[0] ?? "").toLowerCase();
}

/**
 * The groups that apply to a crawler, as Google picks them: groups naming the
 * crawler exactly, else the most specific group whose name starts the
 * crawler's name (googlebot for Googlebot-Image), else *. Groups with the
 * same name are merged.
 */
export function groupsFor(parsed: ParsedRobots, userAgent: string): Group[] {
  const token = productToken(userAgent);
  const names = (g: Group) => g.agents.map(productToken);
  const exact = parsed.groups.filter((g) => names(g).includes(token));
  if (exact.length) return exact;
  let best = "";
  for (const g of parsed.groups) for (const a of names(g)) if (a && a !== "*" && token.startsWith(a) && a.length > best.length) best = a;
  if (best) return parsed.groups.filter((g) => names(g).includes(best));
  return parsed.groups.filter((g) => g.agents.some((a) => a.trim() === "*"));
}

export interface Verdict {
  allowed: boolean;
  rule: Rule | null;
  /** The User-agent names of the group that decided, or null when no group applies. */
  group: string[] | null;
  explanation: string;
}

/** Path plus query of a URL or a path, as robots.txt rules see it. */
export function pathOf(urlOrPath: string): string {
  const s = urlOrPath.trim();
  if (/^https?:\/\//i.test(s)) {
    const u = new URL(s);
    return (u.pathname || "/") + u.search;
  }
  return s.startsWith("/") ? s : `/${s}`;
}

interface Compiled {
  pattern: string;
  /** Literal text before the first *, which the path must start with. */
  prefix: string;
  /** Literal pieces between wildcards, which must all occur in the path. */
  pieces: string[];
}

// Rules are prepared once per parsed file, not once per test, so files with thousands of rules stay fast.
const compiled = new WeakMap<Rule, Compiled>();
function compile(r: Rule): Compiled {
  let c = compiled.get(r);
  if (c === undefined) {
    const pattern = normalizePath(r.path);
    const body = pattern.endsWith("$") ? pattern.slice(0, -1) : pattern;
    const star = body.indexOf("*");
    c = { pattern, prefix: star < 0 ? body : body.slice(0, star), pieces: star < 0 ? [] : body.slice(star).split("*").filter(Boolean) };
    compiled.set(r, c);
  }
  return c;
}

function ruleMatches(r: Rule, path: string): boolean {
  const c = compile(r);
  if (!path.startsWith(c.prefix)) return false;
  for (const piece of c.pieces) if (!path.includes(piece)) return false;
  return matches(c.pattern, path);
}

/** Longest matching rule wins; on a tie, Allow wins (RFC 9309 section 2.2.2). */
export function testPath(parsed: ParsedRobots, urlOrPath: string, userAgent: string): Verdict {
  const path = normalizePath(pathOf(urlOrPath));
  if (path === "/robots.txt") return { allowed: true, rule: null, group: null, explanation: "/robots.txt itself is always allowed." };
  const groups = groupsFor(parsed, userAgent);
  if (groups.length === 0) return { allowed: true, rule: null, group: null, explanation: `No group applies to ${userAgent} (and there is no “User-agent: *”), so everything is allowed.` };
  let best: Rule | null = null;
  for (const g of groups) {
    for (const r of g.rules) {
      if (!ruleMatches(r, path)) continue;
      const len = r.path.length;
      if (!best || len > best.path.length || (len === best.path.length && r.type === "allow" && best.type === "disallow")) best = r;
    }
  }
  const agents = [...new Set(groups.flatMap((g) => g.agents))];
  const who = `the group for ${agents.join(", ")}`;
  if (!best) return { allowed: true, rule: null, group: agents, explanation: `No rule in ${who} matches, so it is allowed.` };
  const allowed = best.type === "allow";
  return { allowed, rule: best, group: agents, explanation: `${allowed ? "Allowed" : "Blocked"} by “${allowed ? "Allow" : "Disallow"}: ${best.path}” (line ${best.line}), the longest matching rule in ${who}.` };
}
