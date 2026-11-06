import type { Headers } from "./security";

export type Level = "pass" | "warn" | "fail" | "info";

export interface Note {
  level: Level;
  topic: "caching" | "compression" | "cookies" | "disclosure";
  message: string;
}

function get(h: Headers, name: string): string | null {
  const v = h[name];
  return v && v.length > 0 ? v.join(", ") : null;
}

export function parseCacheControl(value: string): Map<string, string | true> {
  const out = new Map<string, string | true>();
  for (const part of value.split(",")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out.set(k.trim().toLowerCase(), rest.length ? rest.join("=").trim().replace(/^"|"$/g, "") : true);
  }
  return out;
}

const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml|xhtml\+xml|ld\+json|manifest\+json|rss\+xml|atom\+xml)|image\/svg\+xml)/i;

export function checkCaching(h: Headers): Note[] {
  const notes: Note[] = [];
  const cc = get(h, "cache-control");
  const expires = get(h, "expires");
  const type = (get(h, "content-type") ?? "").toLowerCase();
  const isHtml = type.includes("html");
  const add = (level: Level, message: string) => notes.push({ level, topic: "caching", message });

  if (!cc && !expires) {
    add("warn", "No Cache-Control or Expires header, so browsers and CDNs guess how long to keep the response (heuristic caching).");
  } else if (!cc && expires) {
    add("info", "Only Expires is set. Cache-Control: max-age is clearer and is preferred when both are present.");
  }
  if (cc) {
    const d = parseCacheControl(cc);
    const maxAge = typeof d.get("max-age") === "string" ? Number(d.get("max-age")) : null;
    if (d.has("no-store") && ((maxAge !== null && maxAge > 0) || d.has("public") || d.has("immutable"))) {
      add("warn", "no-store is combined with max-age, public or immutable. no-store wins, so the other directives only add confusion.");
    } else if (d.has("no-store")) {
      add("info", "no-store: the response is never cached. Right for private data; for public pages it makes every visit hit the server.");
    }
    if (d.has("private") && d.has("s-maxage")) add("warn", "private and s-maxage conflict: s-maxage only applies to shared caches, which private forbids.");
    if (d.has("public") && d.has("private")) add("warn", "public and private are both set; caches treat the response as private.");
    if (d.has("no-cache")) add("info", "no-cache: caches may store the response but must revalidate it before every use.");
    if (isHtml && maxAge !== null && maxAge > 86_400 && !d.has("no-cache")) {
      add("warn", `HTML is cached for ${Math.round(maxAge / 86400)} days. Visitors may not see updates; long lifetimes suit versioned assets (app.3f2a.js), not pages.`);
    }
    if (isHtml && d.has("immutable")) add("warn", "immutable on an HTML page means browsers never revalidate it during its lifetime.");
    if (maxAge !== null && Number.isNaN(maxAge)) add("fail", "max-age is not a number.");
    if (maxAge !== null && maxAge > 0 && !d.has("no-store") && !isHtml) add("pass", `Cached for ${maxAge >= 86400 ? `${Math.round(maxAge / 86400)} day(s)` : `${maxAge} s`}.`);
    if (maxAge === 0 && !d.has("must-revalidate") && !d.has("no-cache") && !d.has("no-store")) {
      add("info", "max-age=0 without must-revalidate: some caches may still serve a stale copy when the server is down.");
    }
  }
  if (cc && expires) {
    const t = Date.parse(expires);
    if (!Number.isNaN(t) && t < Date.now() && /max-age=[1-9]/.test(cc)) add("info", "Expires is in the past, but Cache-Control max-age takes precedence.");
  }
  if (!get(h, "etag") && !get(h, "last-modified")) add("info", "No ETag or Last-Modified, so caches cannot revalidate cheaply with a 304 response.");
  if (get(h, "pragma") && !cc) add("info", "Pragma: no-cache is an HTTP/1.0 header; use Cache-Control instead.");
  const vary = get(h, "vary");
  if (vary?.split(",").some((v) => v.trim() === "*")) add("warn", "Vary: * makes the response effectively uncacheable in shared caches.");
  const age = get(h, "age");
  const xcache = get(h, "x-cache") ?? get(h, "cf-cache-status");
  if (age || (xcache && /hit/i.test(xcache))) add("info", `Served from a cache${age ? ` (age ${age} s)` : ""}${xcache ? `: ${xcache}` : ""}.`);
  return notes;
}

export function checkCompression(h: Headers, method: "HEAD" | "GET"): Note[] {
  const type = (get(h, "content-type") ?? "").toLowerCase();
  const enc = (get(h, "content-encoding") ?? "").toLowerCase();
  const add = (level: Level, message: string): Note => ({ level, topic: "compression", message });
  if (enc.includes("br") || enc.includes("zstd")) return [add("pass", `Compressed with ${enc.includes("zstd") ? "Zstandard" : "Brotli"}.`)];
  if (enc.includes("gzip")) return [add("pass", "Compressed with gzip. Brotli usually saves another 15–20% on text.")];
  if (enc.includes("deflate")) return [add("warn", "Compressed with deflate, which some clients handle inconsistently. Prefer gzip or Brotli.")];
  if (type && !COMPRESSIBLE.test(type)) return [add("info", `No compression, which is fine for ${type.split(";")[0]} (already compressed or binary).`)];
  const note = method === "HEAD" ? " (Some servers only report Content-Encoding on GET; try the GET method to confirm.)" : "";
  return [add("fail", `Not compressed although the content is text (${type.split(";")[0] || "unknown type"}). Enable Brotli or gzip.${note}`)];
}

export interface Cookie {
  name: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string | null;
  expires: string | null;
  domain: string | null;
  issues: string[];
}

export function parseCookies(h: Headers, https: boolean): Cookie[] {
  return (h["set-cookie"] ?? []).map((raw) => {
    const [pair, ...attrs] = raw.split(";");
    const name = pair.split("=")[0].trim();
    const a = new Map<string, string | true>();
    for (const attr of attrs) {
      const [k, ...v] = attr.trim().split("=");
      if (k) a.set(k.toLowerCase(), v.length ? v.join("=") : true);
    }
    const sameSite = typeof a.get("samesite") === "string" ? (a.get("samesite") as string) : null;
    const c: Cookie = {
      name,
      secure: a.has("secure"),
      httpOnly: a.has("httponly"),
      sameSite,
      expires: typeof a.get("expires") === "string" ? (a.get("expires") as string) : typeof a.get("max-age") === "string" ? `max-age ${a.get("max-age")}` : null,
      domain: typeof a.get("domain") === "string" ? (a.get("domain") as string) : null,
      issues: [],
    };
    if (https && !c.secure) c.issues.push("no Secure flag: it can be sent over plain HTTP");
    if (!c.httpOnly && /sess|auth|token|sid|login/i.test(name)) c.issues.push("looks like a session cookie but has no HttpOnly flag, so scripts can read it");
    if (!sameSite) c.issues.push("no SameSite attribute (browsers default to Lax)");
    if (sameSite?.toLowerCase() === "none" && !c.secure) c.issues.push("SameSite=None requires Secure, so browsers reject this cookie");
    if (/^__(secure|host)-/i.test(name) && !c.secure) c.issues.push("the __Secure-/__Host- prefix requires the Secure flag");
    return c;
  });
}

export function checkCookies(cookies: Cookie[]): Note[] {
  if (cookies.length === 0) return [];
  const bad = cookies.filter((c) => c.issues.length > 0);
  if (bad.length === 0) return [{ level: "pass", topic: "cookies", message: `${cookies.length} cookie(s) set, all with Secure and SameSite.` }];
  return bad.map((c) => ({ level: c.issues.some((i) => i.includes("rejects") || i.includes("plain HTTP") || i.includes("HttpOnly")) ? "warn" : "info", topic: "cookies", message: `Cookie ${c.name}: ${c.issues.join("; ")}.` }));
}

export function checkDisclosure(h: Headers): Note[] {
  const notes: Note[] = [];
  const server = get(h, "server");
  if (server && /\d/.test(server)) notes.push({ level: "warn", topic: "disclosure", message: `Server: ${server} reveals a version number, which helps attackers find known bugs. Hide the version.` });
  for (const name of ["x-powered-by", "x-aspnet-version", "x-aspnetmvc-version", "x-generator"]) {
    const v = get(h, name);
    if (v) notes.push({ level: "warn", topic: "disclosure", message: `${name}: ${v} reveals the software stack. Remove the header.` });
  }
  if (get(h, "access-control-allow-origin") === "*" && get(h, "access-control-allow-credentials") === "true") {
    notes.push({ level: "fail", topic: "disclosure", message: "Access-Control-Allow-Origin: * with Allow-Credentials: true is invalid and signals a misconfigured CORS setup." });
  }
  const xss = get(h, "x-xss-protection");
  if (xss && !xss.startsWith("0")) notes.push({ level: "info", topic: "disclosure", message: "X-XSS-Protection is obsolete and can introduce bugs in old browsers; set it to 0 or remove it, and rely on CSP." });
  return notes;
}
