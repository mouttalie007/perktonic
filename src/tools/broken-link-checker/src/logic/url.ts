import { MAX_URL_LENGTH } from "./types";

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

const PRIVATE_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[?::1\]?|\[?f[cd][0-9a-f]{2}:.*|\[?fe80:.*)$/i;

/** The start URL: https:// when no scheme is given, ports 80/443 only, no credentials, no private hosts. */
export function normalizeStart(raw: string): UrlCheck {
  const input = raw.trim();
  if (input === "") return { ok: false, error: "Enter the address of the page to start from, for example https://example.com/." };
  if (input.length > MAX_URL_LENGTH) return { ok: false, error: `The URL is ${input.length} characters long; the limit is ${MAX_URL_LENGTH}.` };
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return { ok: false, error: "That does not look like a valid URL." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, error: "Only http:// and https:// sites can be crawled." };
  if (u.username || u.password) return { ok: false, error: "Remove the user name and password from the URL; the crawler never logs in." };
  if (u.port && u.port !== "80" && u.port !== "443") return { ok: false, error: "Only the standard ports 80 and 443 can be crawled." };
  if (PRIVATE_HOST.test(u.hostname) || !u.hostname.includes(".")) return { ok: false, error: "That address is on a private or local network, so the crawler cannot reach it." };
  u.hash = "";
  return { ok: true, url: u.toString() };
}

const SKIP = /^(mailto|tel|sms|javascript|data|ftp|file|about|blob|callto|skype|whatsapp|geo|market|intent):/i;

export type LinkResult = { kind: "url"; url: string } | { kind: "skip"; reason: "scheme" | "fragment" | "invalid" };

/** Resolves an href against the page, drops the fragment and skips non-web schemes. */
export function resolveLink(href: string, base: string): LinkResult {
  const h = href.trim();
  if (h === "" || h.startsWith("#")) return { kind: "skip", reason: "fragment" };
  if (SKIP.test(h)) return { kind: "skip", reason: "scheme" };
  let u: URL;
  try {
    u = new URL(h, base);
  } catch {
    return { kind: "skip", reason: "invalid" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { kind: "skip", reason: "scheme" };
  u.hash = "";
  // An empty query ("page?") is the same page.
  return { kind: "url", url: u.search === "" ? u.toString().replace(/\?$/, "") : u.toString() };
}

export const originOf = (url: string) => new URL(url).origin;
export const hostOf = (url: string) => new URL(url).host;
/** Origin + path, without the query: the key for counting query-string variants. */
export const pathKey = (url: string) => {
  const u = new URL(url);
  return `${u.origin}${u.pathname}`;
};
