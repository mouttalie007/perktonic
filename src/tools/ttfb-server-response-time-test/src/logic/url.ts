import { MAX_URL_LENGTH } from "./types";

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

const PRIVATE_V4 = /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|22[4-9]\.|2[3-5]\d\.)/;
const PRIVATE_V6 = /^(::1?|f[cd][0-9a-f]{2}:.*|fe[89ab][0-9a-f]:.*|::ffff:.*|ff[0-9a-f]{2}:.*)$/i;
const LOCAL_NAME = /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.home\.arpa)$/i;

/**
 * Friendly first check of what the visitor typed. The kit's safeFetch does the
 * real SSRF protection (after DNS resolution); this only rejects the obvious
 * cases early with a clearer message. A missing scheme means https://, because
 * that is what a visitor's browser would use for most sites today.
 */
export function normalizeUrl(raw: string): UrlCheck {
  const input = raw.trim();
  if (input === "") return { ok: false, error: "Enter a URL, for example https://example.com." };
  if (input.length > MAX_URL_LENGTH) return { ok: false, error: `The URL is ${input.length} characters long; the limit is ${MAX_URL_LENGTH}.` };
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input.replace(/^\/\//, "")}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return { ok: false, error: "That does not look like a valid URL. Check for spaces or missing dots." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, error: `Only http:// and https:// URLs can be tested, not ${u.protocol.replace(":", "")}:.` };
  if (u.username || u.password) return { ok: false, error: "Remove the user name and password from the URL; the tester never sends credentials." };
  if (u.port && u.port !== "80" && u.port !== "443") return { ok: false, error: "Only the standard ports 80 and 443 can be tested." };
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const isV6 = host.includes(":");
  const isV4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (LOCAL_NAME.test(host) || (isV4 && PRIVATE_V4.test(host)) || (isV6 && PRIVATE_V6.test(host)) || (!isV6 && !host.includes("."))) {
    return { ok: false, error: "That address is on a private or local network, so the tester cannot reach it." };
  }
  return { ok: true, url: u.toString() };
}

export function ipVersion(ip: string | null): 4 | 6 | null {
  if (!ip) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || /^::ffff:\d{1,3}(\.\d{1,3}){3}$/i.test(ip)) return 4;
  return ip.includes(":") ? 6 : null;
}
