/**
 * robots.txt as RFC 9309 describes it: the group for our product token
 * (PerkTonicBot) if there is one, otherwise the * group; the longest matching
 * rule wins and Allow wins a tie; * and $ wildcards.
 */
export interface Robots {
  rules: { allow: boolean; pattern: string; re: RegExp }[];
  crawlDelayMs: number | null;
}

const TOKEN = "perktonicbot";

function toRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

export function parseRobots(text: string): Robots {
  type Group = { agents: string[]; rules: { allow: boolean; pattern: string }[]; delay: number | null };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], delay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      if (value === "" && key === "disallow") continue;
      current.rules.push({ allow: key === "allow", pattern: value.startsWith("/") || value.startsWith("*") ? value : `/${value}` });
    } else if (key === "crawl-delay" && /^\d+(\.\d+)?$/.test(value)) current.delay = Math.round(Number(value) * 1000);
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && TOKEN.includes(a.replace(/\/.*$/, ""))));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  return {
    rules: chosen.flatMap((g) => g.rules).map((r) => ({ ...r, re: toRegExp(r.pattern) })),
    crawlDelayMs: chosen.find((g) => g.delay !== null)?.delay ?? null,
  };
}

export const ALLOW_ALL: Robots = { rules: [], crawlDelayMs: null };
export const DISALLOW_ALL: Robots = { rules: [{ allow: false, pattern: "/", re: /^\// }], crawlDelayMs: null };

export function isAllowed(robots: Robots, url: string): boolean {
  const u = new URL(url);
  let path = u.pathname + u.search;
  try {
    path = decodeURI(u.pathname) + u.search;
  } catch {
    // Malformed percent-encoding: match the raw path.
  }
  let best: { allow: boolean; len: number } | null = null;
  for (const r of robots.rules) {
    if (!r.re.test(path) && !r.re.test(u.pathname + u.search)) continue;
    const len = r.pattern.length;
    if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len };
  }
  return best ? best.allow : true;
}
