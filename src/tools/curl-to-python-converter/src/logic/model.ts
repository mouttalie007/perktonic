export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export interface Part {
  name: string;
  /** Text value, or the local file path when `file` is true. */
  value: string;
  file: boolean;
  filename?: string;
  contentType?: string;
}

export type Body =
  | { kind: "json"; text: string; value: JsonValue }
  | { kind: "form"; fields: [string, string][] }
  | { kind: "raw"; text: string }
  | { kind: "file"; path: string }
  | { kind: "multipart"; parts: Part[] };

/** One HTTP request, independent of the language that described it. */
export interface Request {
  method: string;
  url: string;
  headers: [string, string][];
  body: Body | null;
  auth: { user: string; password: string } | null;
  insecure: boolean;
  followRedirects: boolean;
  maxRedirects: number | null;
  compressed: boolean;
  timeoutSeconds: number | null;
  connectTimeoutSeconds: number | null;
  proxy: string | null;
  /** Options that were understood but have no equivalent in code, with the reason. */
  unmapped: { option: string; reason: string }[];
  warnings: string[];
}

export function emptyRequest(): Request {
  return { method: "GET", url: "", headers: [], body: null, auth: null, insecure: false, followRedirects: false, maxRedirects: null, compressed: false, timeoutSeconds: null, connectTimeoutSeconds: null, proxy: null, unmapped: [], warnings: [] };
}

export function header(req: Request, name: string): string | null {
  const h = req.headers.find(([k]) => k.toLowerCase() === name.toLowerCase());
  return h ? h[1] : null;
}

export class ConvertError extends Error {}

/** Pasted input limit from the brief (5 MB of UTF-8). */
export const MAX_INPUT_BYTES = 5 * 1024 * 1024;

export function tooLarge(text: string): string | null {
  // Cheap check first: every UTF-16 unit is at most 3 UTF-8 bytes.
  if (text.length * 3 <= MAX_INPUT_BYTES) return null;
  const bytes = new TextEncoder().encode(text).length;
  if (bytes <= MAX_INPUT_BYTES) return null;
  return `The input is ${(bytes / 1024 / 1024).toFixed(1)} MB; the limit is 5 MB of pasted text.`;
}
