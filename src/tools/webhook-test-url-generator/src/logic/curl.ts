// "Copy as cURL", built in the browser with POSIX shell quoting.
import type { Captured } from "../types";
import { base64ToBytes } from "./format";

/** Single quotes, with any ' inside written as '\'' (safe for sh, bash and zsh). */
export const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

const SKIP = /^(host|content-length|connection|accept-encoding)$/i;

export function toCurl(c: Captured, url = c.url): string {
  // One option per line, each with its value.
  const lines = ["curl"];
  if (c.method === "HEAD") lines.push("--head");
  else if (c.method !== "GET" || c.body.size > 0) lines.push(`-X ${c.method}`);
  lines.push(shellQuote(url));
  for (const [k, v] of c.headers) if (!SKIP.test(k)) lines.push(`-H ${shellQuote(`${k}: ${v}`)}`);
  if (c.body.size > 0 && c.method !== "HEAD") {
    if (c.body.text !== null) lines.push(`--data-binary ${shellQuote(c.body.text)}`);
    else {
      // Binary: write it to a file first; cURL reads it with @file.
      const hex = [...base64ToBytes(c.body.base64)].map((b) => `\\x${b.toString(16).padStart(2, "0")}`).join("");
      return `printf ${shellQuote(hex)} > body.bin && ${[...lines, "--data-binary @body.bin"].join(" ")}`;
    }
  }
  return lines.join(" \\\n  ");
}
