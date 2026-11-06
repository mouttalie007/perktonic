// Types shared by the server and the browser component (type-only imports).
import type { ReplyType } from "./limits";

export interface CapturedBody {
  /** The bytes as base64 (at most 256 KB kept). */
  base64: string;
  /** UTF-8 text when the body is valid text, else null (binary: shown as hex and base64). */
  text: string | null;
  size: number;
  truncated: boolean;
}

export interface Captured {
  id: string;
  /** ISO time (UTC). */
  at: string;
  method: string;
  url: string;
  path: string;
  query: [string, string][];
  headers: [string, string][];
  headersTruncated: boolean;
  contentType: string | null;
  body: CapturedBody;
  /** From x-forwarded-for (the first address), or null. */
  ip: string | null;
}

export interface ReplySettings {
  status: number;
  contentType: ReplyType;
  body: string;
  delayMs: number;
}

export interface EndpointView {
  id: string;
  createdAt: string;
  expiresAt: string;
  extensionsLeft: number;
  reply: ReplySettings;
  requests: Captured[];
}

export interface ReplayResult {
  status: number;
  headers: [string, string][];
  body: string;
  truncated: boolean;
  totalMs: number;
}

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
