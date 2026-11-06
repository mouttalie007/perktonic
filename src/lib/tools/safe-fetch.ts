import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";

/**
 * The only way a tool may make an outbound HTTP request with a user-supplied
 * URL. Protects us from SSRF: http(s) only, ports 80/443 only, no credentials,
 * and every connection is checked AFTER DNS resolution (so a hostname that
 * resolves to a private address, or flips between public and private, is
 * refused). Redirects are never followed here; `safeFetchHops` walks them one
 * at a time and re-checks every hop. Limits: timeout, response size.
 */
export interface Timings {
  dnsMs: number | null;
  connectMs: number | null;
  tlsMs: number | null;
  ttfbMs: number;
  totalMs: number;
}

export interface SafeFetchOptions {
  method?: "GET" | "HEAD" | "POST";
  /** Request body, POST only, at most 64 KB (used for webhook alerts). */
  body?: string;
  headers?: Record<string, string>;
  /** Total time for headers + body. Default 10 s. */
  timeoutMs?: number;
  /** Body bytes kept (after decompression). Default 2 MB. */
  maxBytes?: number;
  userAgent?: string;
}

export interface SafeResponse {
  url: string;
  status: number;
  headers: Record<string, string[]>;
  body: Uint8Array;
  truncated: boolean;
  timings: Timings;
  remoteIp: string | null;
}

export interface Hop extends SafeResponse {
  location: string | null;
}

export type SafeFetchErrorCode =
  | "invalid_url"
  | "blocked_host"
  | "timeout"
  | "too_large"
  | "network"
  | "too_many_redirects";

export class SafeFetchError extends Error {
  constructor(
    public code: SafeFetchErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2_000_000;
const MAX_URL_LENGTH = 2048;
const DEFAULT_UA = "PerkTonicBot/1.0 (+https://perktonic.com/tools)";

/* ------------------------------------------------------------------ */
/* Address policy                                                      */
/* ------------------------------------------------------------------ */

const blocked = new net.BlockList();
const V4: [string, number][] = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, cloud metadata (169.254.169.254)
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];
for (const [addr, prefix] of V4) blocked.addSubnet(addr, prefix, "ipv4");
const V6: [string, number][] = [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96], // NAT64 (embeds an IPv4 address)
  ["100::", 64], // discard-only
  ["2001::", 32], // Teredo
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4 (embeds an IPv4 address)
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
];
for (const [addr, prefix] of V6) blocked.addSubnet(addr, prefix, "ipv6");

/** true when connecting to this literal address is not allowed. */
export function isBlockedAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "").split("%")[0]!;
  if (net.isIPv4(bare)) return blocked.check(bare, "ipv4");
  if (net.isIPv6(bare)) {
    // IPv4-mapped (::ffff:a.b.c.d or ::ffff:7f00:1): judge the embedded IPv4 address.
    const mapped = bare.toLowerCase().match(/^(?:0*:){0,5}ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
    if (mapped) {
      const v4 = mapped[1] ?? `${parseInt(mapped[2]!, 16) >> 8}.${parseInt(mapped[2]!, 16) & 255}.${parseInt(mapped[3]!, 16) >> 8}.${parseInt(mapped[3]!, 16) & 255}`;
      return blocked.check(v4, "ipv4");
    }
    return blocked.check(bare, "ipv6");
  }
  return true; // not an IP at all: never connect
}

/** Syntax and policy checks that need no network. */
export function checkUrl(raw: string): URL {
  if (typeof raw !== "string" || raw.length > MAX_URL_LENGTH) {
    throw new SafeFetchError("invalid_url", "That URL is too long.");
  }
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SafeFetchError("invalid_url", "That does not look like a valid URL.");
  }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) {
    throw new SafeFetchError("invalid_url", "Only plain http(s) URLs without a username or password are allowed.");
  }
  const port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80;
  if (port !== 80 && port !== 443) {
    throw new SafeFetchError("blocked_host", "Only the standard web ports (80 and 443) can be checked.");
  }
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new SafeFetchError("blocked_host", "That address is private and cannot be checked.");
  }
  // Numeric forms the URL parser already normalised (e.g. http://2130706433/) arrive as dotted IPv4.
  if (net.isIP(host) && isBlockedAddress(host)) {
    throw new SafeFetchError("blocked_host", "That address is private and cannot be checked.");
  }
  return u;
}

/** dns.lookup replacement that refuses private results at connection time (defeats DNS rebinding). */
export const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return (callback as (e: NodeJS.ErrnoException) => void)(err);
    const list = addresses as dns.LookupAddress[];
    if (!list.length) return (callback as (e: Error) => void)(new Error("ENOTFOUND"));
    const bad = list.find((a) => isBlockedAddress(a.address));
    if (bad) {
      const e = new Error("blocked_host") as NodeJS.ErrnoException;
      e.code = "EBLOCKED";
      return (callback as (e: Error) => void)(e);
    }
    const first = list[0]!;
    if (options.all) return (callback as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    return (callback as (e: null, a: string, f: number) => void)(null, first.address, first.family);
  });
};

/* ------------------------------------------------------------------ */
/* Request                                                             */
/* ------------------------------------------------------------------ */

function decoder(encoding: string | undefined): zlib.Gunzip | zlib.Inflate | zlib.BrotliDecompress | null {
  switch ((encoding ?? "").trim().toLowerCase()) {
    case "gzip":
    case "x-gzip":
      return zlib.createGunzip({ finishFlush: zlib.constants.Z_SYNC_FLUSH });
    case "deflate":
      return zlib.createInflate({ finishFlush: zlib.constants.Z_SYNC_FLUSH });
    case "br":
      return zlib.createBrotliDecompress({ finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH });
    default:
      return null;
  }
}

/** One request, redirects NOT followed (the caller decides). */
export async function safeFetch(url: string, opts: SafeFetchOptions = {}): Promise<SafeResponse> {
  const u = checkUrl(url);
  const method = opts.method ?? "GET";
  const reqBody = method === "POST" ? Buffer.from(opts.body ?? "", "utf8") : null;
  if (reqBody && reqBody.length > 64 * 1024) throw new SafeFetchError("too_large", "The request body is too large.");
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const isTls = u.protocol === "https:";

  return new Promise<SafeResponse>((resolve, reject) => {
    const t0 = performance.now();
    const marks: { dns: number | null; connect: number | null; tls: number | null } = { dns: null, connect: null, tls: null };
    let settled = false;
    // Assigned after the closures below that destroy it on failure, so it cannot be a const.
    // eslint-disable-next-line prefer-const
    let req: http.ClientRequest | undefined;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const fail = (code: SafeFetchErrorCode, message: string) =>
      done(() => {
        req?.destroy();
        reject(new SafeFetchError(code, message));
      });
    const timer = setTimeout(() => fail("timeout", "The site took too long to answer."), timeoutMs);

    const headers: Record<string, string> = {
      "user-agent": opts.userAgent ?? DEFAULT_UA,
      "accept-encoding": "gzip, deflate, br",
      accept: "*/*",
      ...Object.fromEntries(Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])),
      host: u.host,
      ...(reqBody ? { "content-length": String(reqBody.length) } : {}),
    };

    const lib = isTls ? https : http;
    req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname.replace(/^\[|\]$/g, ""),
        port: u.port || (isTls ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method,
        headers,
        lookup: guardedLookup,
        agent: false, // no keep-alive pooling between unrelated visitors
        servername: net.isIP(u.hostname) ? undefined : u.hostname,
        maxHeaderSize: 32 * 1024,
      } as https.RequestOptions,
      (res) => {
        const ttfb = performance.now() - t0;
        const remoteIp = res.socket?.remoteAddress ?? null;
        // Defence in depth: the socket really is connected to a permitted address.
        if (remoteIp && isBlockedAddress(remoteIp)) return fail("blocked_host", "That address is private and cannot be checked.");

        const out: Record<string, string[]> = {};
        for (let i = 0; i < res.rawHeaders.length; i += 2) {
          (out[res.rawHeaders[i]!.toLowerCase()] ??= []).push(res.rawHeaders[i + 1]!);
        }
        const finish = (chunks: Buffer[], truncated: boolean) =>
          done(() => {
            const buf = Buffer.concat(chunks);
            const body = new Uint8Array(buf.subarray(0, maxBytes));
            resolve({
              url: u.toString(),
              status: res.statusCode ?? 0,
              headers: out,
              body,
              truncated: truncated || buf.length > maxBytes,
              timings: {
                dnsMs: marks.dns,
                connectMs: marks.connect,
                tlsMs: marks.tls,
                ttfbMs: Math.round(ttfb),
                totalMs: Math.round(performance.now() - t0),
              },
              remoteIp,
            });
            res.destroy();
          });

        if (method === "HEAD" || maxBytes === 0) return finish([], false);

        const chunks: Buffer[] = [];
        let size = 0;
        const dec = decoder(out["content-encoding"]?.[0]);
        const source: NodeJS.ReadableStream = dec ? res.pipe(dec) : res;
        source.on("data", (c: Buffer) => {
          chunks.push(c);
          size += c.length;
          if (size > maxBytes) {
            source.removeAllListeners("data");
            finish(chunks, true);
          }
        });
        source.on("end", () => finish(chunks, false));
        // A body cut off mid-stream (or a corrupt compressed stream) keeps what we already have.
        source.on("error", () => finish(chunks, true));
        res.on("error", () => finish(chunks, true));
      },
    );

    req.on("socket", (socket) => {
      socket.once("lookup", () => (marks.dns = Math.round(performance.now() - t0)));
      socket.once("connect", () => (marks.connect = Math.round(performance.now() - t0)));
      socket.once("secureConnect", () => (marks.tls = Math.round(performance.now() - t0)));
    });
    req.on("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "EBLOCKED") return fail("blocked_host", "That address is private and cannot be checked.");
      if (e.code === "ENOTFOUND" || e.code === "EAI_AGAIN") return fail("network", "We could not find that site. Check the address for typos.");
      if (e.code === "ECONNREFUSED") return fail("network", "That site refused the connection.");
      if (e.code === "CERT_HAS_EXPIRED" || e.code === "DEPTH_ZERO_SELF_SIGNED_CERT" || e.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || e.code === "ERR_TLS_CERT_ALTNAME_INVALID") {
        return fail("network", "The site's security certificate is not valid.");
      }
      return fail("network", "Could not connect to that site.");
    });
    if (reqBody) req.end(reqBody);
    else req.end();
  });
}

/** Follows redirects one hop at a time; yields every response (including the final one). Every hop is re-validated. */
export async function* safeFetchHops(
  url: string,
  opts: SafeFetchOptions & { maxHops?: number } = {},
): AsyncGenerator<Hop> {
  let current = url;
  const max = opts.maxHops ?? 10;
  for (let i = 0; i <= max; i++) {
    const r = await safeFetch(current, opts);
    const loc = r.headers["location"]?.[0] ?? null;
    let next: string | null = null;
    if (loc) {
      try {
        next = new URL(loc, r.url).toString();
      } catch {
        next = null;
      }
    }
    yield { ...r, location: next };
    if (r.status < 300 || r.status > 399 || !next) return;
    current = next;
  }
  throw new SafeFetchError("too_many_redirects", "Too many redirects.");
}
