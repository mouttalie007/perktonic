import { gunzipSync } from "node:zlib";
import type { SafeFetchOptions, SafeResponse } from "@/lib/tools/safe-fetch";
import { GUNZIP_MAX_BYTES } from "./limits";

export type Fetcher = (url: string, opts?: SafeFetchOptions) => Promise<SafeResponse>;

export interface Fetched {
  finalUrl: string;
  status: number;
  contentType: string | null;
  declaredBytes: number | null;
  bytes: number;
  truncated: boolean;
  gzipped: boolean;
  unpackedBytes: number | null;
  text: string;
}

export class FetchProblem extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const REASONS: Record<string, string> = {
  invalid_url: "That is not a valid http(s) URL.",
  blocked_host: "This address is private or reserved, so it is not fetched.",
  timeout: "The site did not answer within 10 seconds.",
  too_large: "The response was too large.",
  network: "Could not connect to the site (the domain may not exist, or the server refused the connection).",
  too_many_redirects: "Too many redirects.",
};

/** GET with redirects followed one hop at a time (at most 5, as RFC 9309 suggests), then the body as text, unpacking gzip. */
export async function fetchText(url: string, maxBytes: number, fetcher: Fetcher): Promise<Fetched> {
  let current = url;
  for (let hop = 0; hop <= 5; hop++) {
    let res: SafeResponse;
    try {
      res = await fetcher(current, { method: "GET", maxBytes, timeoutMs: 10_000, headers: { accept: "text/plain, application/xml, text/xml, */*;q=0.5" } });
    } catch (e) {
      const code = typeof (e as { code?: unknown }).code === "string" ? (e as { code: string }).code : "network";
      throw new FetchProblem(code, REASONS[code] ?? REASONS.network);
    }
    const location = res.headers["location"]?.[0];
    if (res.status >= 300 && res.status < 400 && location) {
      try {
        current = new URL(location, current).toString();
      } catch {
        throw new FetchProblem("invalid_url", `The redirect points to an invalid address (${location.slice(0, 100)}).`);
      }
      continue;
    }
    const contentType = res.headers["content-type"]?.[0]?.split(";")[0].trim().toLowerCase() ?? null;
    const len = Number(res.headers["content-length"]?.[0]);
    let body = res.body;
    let gzipped = false;
    let unpackedBytes: number | null = null;
    let truncated = res.truncated;
    // A .xml.gz file arrives still compressed (it is the file itself, not a Content-Encoding), so it is unpacked here.
    if (body[0] === 0x1f && body[1] === 0x8b) {
      gzipped = true;
      if (truncated) throw new FetchProblem("too_large", "The compressed file is larger than our 2 MB download limit, so it could not be unpacked.");
      try {
        body = new Uint8Array(gunzipSync(body, { maxOutputLength: GUNZIP_MAX_BYTES }));
      } catch (e) {
        if ((e as { code?: string }).code === "ERR_BUFFER_TOO_LARGE") throw new FetchProblem("too_large", "Unpacked, this file is larger than 10 MB, the most we unpack.");
        throw new FetchProblem("bad_gzip", "The file starts like gzip but could not be unpacked; it may be damaged.");
      }
      unpackedBytes = body.length;
      truncated = false;
    }
    return { finalUrl: current, status: res.status, contentType, declaredBytes: Number.isFinite(len) && len > 0 ? len : null, bytes: res.body.length, truncated, gzipped, unpackedBytes, text: new TextDecoder("utf-8").decode(body) };
  }
  throw new FetchProblem("too_many_redirects", "More than 5 redirects.");
}
