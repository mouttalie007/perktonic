// Turning an incoming HTTP request into a stored capture (pure; the route reads the stream).
import { MAX_BODY_BYTES, MAX_HEADER_BYTES } from "../limits";
import type { Captured } from "../types";

/**
 * Headers added by OUR infrastructure (proxy, CDN, load balancer) are never echoed: they would
 * reveal internal addresses. The sender's address is shown once, from x-forwarded-for.
 */
const INFRA = /^(x-forwarded-.*|x-real-ip|forwarded|via|cf-.*|cdn-loop|true-client-ip|x-amzn-.*|x-vercel-.*|x-nginx-.*|x-envoy-.*|x-request-start|x-middleware-.*|x-invoke-.*|x-matched-path|x-next-.*|next-router-.*|rsc)$/i;

/** Known scanners and spam tools: their requests are refused (403) and not stored. */
export const BLOCKED_AGENTS = /\b(masscan|zgrab|sqlmap|nikto|nmap|nuclei|dirbuster|gobuster|wpscan|acunetix|netsparker|censys|shodan)\b/i;

export function senderIp(headers: [string, string][]): string | null {
  const xff = headers.find(([k]) => k.toLowerCase() === "x-forwarded-for")?.[1] ?? headers.find(([k]) => k.toLowerCase() === "x-real-ip")?.[1];
  const first = xff?.split(",")[0]?.trim();
  return first || null;
}

/** Headers kept for display, up to 64 KB in total (the rest is dropped and flagged). */
export function visibleHeaders(all: [string, string][]): { headers: [string, string][]; truncated: boolean } {
  const out: [string, string][] = [];
  let size = 0;
  let truncated = false;
  for (const [k, v] of all) {
    if (INFRA.test(k)) continue;
    size += k.length + v.length + 4;
    if (size > MAX_HEADER_BYTES) {
      truncated = true;
      break;
    }
    out.push([k, v]);
  }
  return { headers: out, truncated };
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** UTF-8 text, or null for binary (invalid UTF-8 or control bytes other than tab and line breaks). */
export function asText(bytes: Uint8Array, truncated: boolean): string | null {
  if (!bytes.length) return "";
  try {
    // A truncated body may end inside a multi-byte character: decode leniently only at the very end.
    const text = new TextDecoder("utf-8", { fatal: !truncated }).decode(bytes);
    if (/[\u0000-\u0008\u000E-\u001A\u001C-\u001F]/.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}

export interface Incoming {
  method: string;
  url: string;
  headers: [string, string][];
  /** At most MAX_BODY_BYTES bytes. */
  body: Uint8Array;
  /** The sender sent more than MAX_BODY_BYTES. */
  truncated: boolean;
  /** Bytes actually received (when known), else body.length. */
  size: number;
}

export function buildCapture(req: Incoming, id: string, at: Date): Captured {
  const u = new URL(req.url);
  const { headers, truncated: headersTruncated } = visibleHeaders(req.headers);
  const body = req.body.subarray(0, MAX_BODY_BYTES);
  return {
    id,
    at: at.toISOString(),
    method: req.method.toUpperCase(),
    url: u.toString(),
    path: u.pathname,
    query: [...u.searchParams.entries()],
    headers,
    headersTruncated,
    contentType: req.headers.find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? null,
    body: { base64: toBase64(body), text: asText(body, req.truncated), size: req.size, truncated: req.truncated },
    ip: senderIp(req.headers),
  };
}

/** Reads a request body up to `max` bytes; the rest is counted but not kept. */
export async function readCapped(stream: ReadableStream<Uint8Array> | null, max = MAX_BODY_BYTES): Promise<{ body: Uint8Array; truncated: boolean; size: number }> {
  if (!stream) return { body: new Uint8Array(0), truncated: false, size: 0 };
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let kept = 0;
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (kept < max) {
      const part = value.subarray(0, max - kept);
      chunks.push(part);
      kept += part.length;
    }
    // Stop reading a very large body (a flood): 4 × the cap is enough to say it was truncated.
    if (size > max * 4) {
      await reader.cancel();
      break;
    }
  }
  const body = new Uint8Array(kept);
  let off = 0;
  for (const c of chunks) {
    body.set(c, off);
    off += c.length;
  }
  return { body, truncated: size > max, size };
}
