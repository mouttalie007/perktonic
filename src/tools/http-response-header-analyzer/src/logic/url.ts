export const MAX_URL_LENGTH = 2048;

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

const PRIVATE_HOST_RE =
  /^(localhost|.*\.localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+|\[?::1\]?|\[?f[cd][0-9a-f]{2}:.*|\[?fe80:.*)$/i;

/**
 * Friendly first check of what the visitor typed. The kit's safeFetch does the
 * real SSRF protection (DNS resolution, every redirect); this only catches the
 * obvious cases early with a clearer message. A missing scheme means https://,
 * because security headers only matter on HTTPS responses.
 */
export function normalizeUrl(raw: string): UrlCheck {
  const input = raw.trim();
  if (input === "") return { ok: false, error: "Enter a URL, for example https://example.com." };
  if (input.length > MAX_URL_LENGTH) return { ok: false, error: `The URL is ${input.length} characters long; the limit is ${MAX_URL_LENGTH}.` };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return { ok: false, error: "That does not look like a valid URL. Check for spaces or missing dots." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, error: `Only http:// and https:// URLs can be checked, not ${u.protocol.replace(":", "")}:.` };
  }
  if (u.username || u.password) return { ok: false, error: "Remove the user name and password from the URL; the analyzer never sends credentials." };
  if (u.port && u.port !== "80" && u.port !== "443") return { ok: false, error: "Only the standard ports 80 and 443 can be checked." };
  if (PRIVATE_HOST_RE.test(u.hostname) || !u.hostname.includes(".")) {
    return { ok: false, error: "That address is on a private or local network, so the analyzer cannot visit it." };
  }
  return { ok: true, url: u.toString() };
}
