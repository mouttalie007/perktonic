import { parse } from "node-html-parser";

export interface ClientRedirect {
  kind: "meta-refresh" | "javascript";
  target: string | null;
  delaySeconds: number | null;
  snippet: string;
}

const JS_PATTERNS = [
  // A bare `location = "…"` is skipped on purpose: it is usually a variable (const location = "Paris").
  /(?:(?:window|document|self|top)\.location(?:\.href)?|location\.href)\s*=\s*["'`]([^"'`]+)["'`]/,
  /location\.(?:replace|assign)\(\s*["'`]([^"'`]+)["'`]\s*\)/,
  /window\.navigate\(\s*["'`]([^"'`]+)["'`]\s*\)/,
];

function resolve(target: string, base: string): string | null {
  try {
    return new URL(target, base).toString();
  } catch {
    return null;
  }
}

/**
 * Finds redirects that happen in the browser rather than via HTTP: a
 * <meta http-equiv="refresh"> tag or an inline script that sets location.
 * Reported as information only; script redirects cannot be followed safely.
 */
export function findClientRedirects(html: string, baseUrl: string): ClientRedirect[] {
  const found: ClientRedirect[] = [];
  // Only the head and the start of the body matter; this also bounds parsing time.
  const doc = parse(html.slice(0, 300_000), { lowerCaseTagName: true });
  for (const meta of doc.querySelectorAll("meta")) {
    if ((meta.getAttribute("http-equiv") ?? "").toLowerCase() !== "refresh") continue;
    const content = meta.getAttribute("content") ?? "";
    const m = /^\s*(\d+(?:\.\d+)?)?\s*[;,]?\s*(?:url\s*=\s*)?['"]?([^'"]*)['"]?\s*$/i.exec(content);
    const delay = m?.[1] !== undefined ? Number(m[1]) : null;
    const raw = m?.[2]?.trim() || null;
    found.push({ kind: "meta-refresh", target: raw ? resolve(raw, baseUrl) : null, delaySeconds: delay, snippet: `<meta http-equiv="refresh" content="${content.slice(0, 120)}">` });
  }
  for (const script of doc.querySelectorAll("script")) {
    if (script.getAttribute("src")) continue;
    const code = script.text.slice(0, 20_000);
    for (const re of JS_PATTERNS) {
      const m = re.exec(code);
      if (m) {
        found.push({ kind: "javascript", target: resolve(m[1], baseUrl), delaySeconds: null, snippet: m[0].slice(0, 120) });
        break;
      }
    }
  }
  return found;
}
