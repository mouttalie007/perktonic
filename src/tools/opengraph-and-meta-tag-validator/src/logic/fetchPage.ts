import { SafeFetchError, type safeFetch, type SafeResponse } from "@/lib/tools/safe-fetch";
import { decodeHtml, detectCharset } from "./extract";
import { MIME, readImageInfo, type ImageInfo } from "./image";

export const MAX_REDIRECTS = 10;
export const PAGE_BYTES = 2_000_000;
/** The kit caps responses at 2 MB, so larger images are measured from Content-Length only. */
export const IMAGE_BYTES = 2_000_000;

export type Fetcher = typeof safeFetch;

export class ValidatorError extends Error {
  constructor(
    public readonly code: SafeFetchError["code"] | "not_html" | "http_error",
    message: string,
  ) {
    super(message);
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function friendlyError(err: unknown, url: string): ValidatorError {
  if (err instanceof ValidatorError) return err;
  if (!(err instanceof SafeFetchError)) return new ValidatorError("network", "Something went wrong while contacting the site.");
  const host = hostOf(url);
  const messages: Record<SafeFetchError["code"], string> = {
    invalid_url: "That URL cannot be checked. Use a plain http:// or https:// address without a user name or password.",
    blocked_host: `${host} points to a private, local or reserved network address, so the validator does not visit it.`,
    timeout: `${host} did not answer within 10 seconds.`,
    too_large: `${host} sent a response that is too large.`,
    network: `Could not connect to ${host}. Check the spelling, or the site may be down.`,
    too_many_redirects: `${host} redirected more than ${MAX_REDIRECTS} times.`,
  };
  return new ValidatorError(err.code, messages[err.code]);
}

async function follow(url: string, fetcher: Fetcher, maxBytes: number): Promise<{ res: SafeResponse; redirects: string[] }> {
  const redirects: string[] = [];
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    let res: SafeResponse;
    try {
      res = await fetcher(current, { method: "GET", maxBytes, timeoutMs: 10_000, headers: { accept: "text/html,application/xhtml+xml,image/*;q=0.9,*/*;q=0.8" } });
    } catch (err) {
      throw friendlyError(err, current);
    }
    const loc = res.headers["location"]?.[0];
    if (res.status >= 300 && res.status <= 399 && loc) {
      redirects.push(current);
      current = new URL(loc, res.url).toString();
      if (redirects.includes(current)) throw new ValidatorError("too_many_redirects", `Redirect loop at ${current}.`);
      continue;
    }
    return { res, redirects };
  }
  throw new ValidatorError("too_many_redirects", `${hostOf(url)} redirected more than ${MAX_REDIRECTS} times.`);
}

export interface PageFetch {
  finalUrl: string;
  status: number;
  redirects: string[];
  html: string;
  truncated: boolean;
  xRobotsTag: string | null;
}

export async function fetchPage(url: string, fetcher: Fetcher): Promise<PageFetch> {
  const { res, redirects } = await follow(url, fetcher, PAGE_BYTES);
  const type = res.headers["content-type"]?.[0] ?? null;
  const looksHtml = /html|xml/i.test(type ?? "") || /^\s*(<!doctype html|<html|<head)/i.test(new TextDecoder().decode(res.body.subarray(0, 256)));
  if (res.status >= 400) throw new ValidatorError("http_error", `The page answered ${res.status}, so there are no tags to check. Crawlers from Facebook, X and LinkedIn would see the same error.`);
  if (!looksHtml) throw new ValidatorError("not_html", `This URL returns ${type?.split(";")[0] ?? "a file"}, not an HTML page. Enter the address of the page you share.`);
  return {
    finalUrl: res.url,
    status: res.status,
    redirects,
    html: decodeHtml(res.body, detectCharset(type, res.body)),
    truncated: res.truncated,
    xRobotsTag: res.headers["x-robots-tag"]?.join(", ") ?? null,
  };
}

export interface ImageFetch extends ImageInfo {
  url: string;
  status: number | null;
  /** Bytes, from Content-Length or the download; null when unknown. */
  size: number | null;
  sizeAtLeast: boolean;
  contentType: string | null;
  /** Small preview for the mockups, only for formats every browser shows. */
  dataUrl: string | null;
  error: string | null;
}

const PREVIEWABLE = new Set(["jpeg", "png", "gif", "webp"]);

export async function fetchImage(url: string, fetcher: Fetcher): Promise<ImageFetch> {
  const empty: ImageFetch = { url, status: null, size: null, sizeAtLeast: false, contentType: null, type: "unknown", width: null, height: null, dataUrl: null, error: null };
  let res: SafeResponse;
  try {
    res = (await follow(url, fetcher, IMAGE_BYTES)).res;
  } catch (err) {
    return { ...empty, error: friendlyError(err, url).message };
  }
  const contentType = res.headers["content-type"]?.[0] ?? null;
  const lengthHeader = Number(res.headers["content-length"]?.[0]);
  const size = Number.isFinite(lengthHeader) && lengthHeader > 0 ? lengthHeader : res.truncated ? IMAGE_BYTES : res.body.length;
  const info = readImageInfo(res.body);
  const out: ImageFetch = { ...empty, ...info, url: res.url, status: res.status, contentType, size, sizeAtLeast: res.truncated && !(lengthHeader > 0) };
  if (res.status >= 400) return { ...out, error: `The image URL answers ${res.status}.` };
  if (!res.truncated && PREVIEWABLE.has(info.type)) out.dataUrl = `data:${MIME[info.type]};base64,${Buffer.from(res.body).toString("base64")}`;
  return out;
}
