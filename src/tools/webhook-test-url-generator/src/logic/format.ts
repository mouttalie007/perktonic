// Views of a captured body for the page (pure, used in the browser).
import type { Captured } from "../types";

export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Classic hex dump: offset, 16 bytes in hex, printable ASCII. */
export function hexDump(bytes: Uint8Array, max = 4096): string {
  const lines: string[] = [];
  for (let off = 0; off < Math.min(bytes.length, max); off += 16) {
    const row = bytes.subarray(off, off + 16);
    const hex = [...row].map((b) => b.toString(16).padStart(2, "0")).join(" ");
    const ascii = [...row].map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".")).join("");
    lines.push(`${off.toString(16).padStart(8, "0")}  ${hex.padEnd(47)}  ${ascii}`);
  }
  if (bytes.length > max) lines.push(`… ${bytes.length - max} more bytes`);
  return lines.join("\n");
}

/** Pretty view for JSON and form bodies; null when the body is neither. */
export function pretty(c: Captured): { kind: "json" | "form"; text: string } | null {
  const t = c.body.text;
  if (t === null || !t.trim()) return null;
  const type = (c.contentType ?? "").toLowerCase();
  if (type.includes("json") || /^\s*[[{]/.test(t)) {
    try {
      return { kind: "json", text: JSON.stringify(JSON.parse(t), null, 2) };
    } catch {
      return null;
    }
  }
  if (type.includes("x-www-form-urlencoded")) {
    const rows = [...new URLSearchParams(t).entries()];
    return { kind: "form", text: rows.map(([k, v]) => `${k} = ${v}`).join("\n") };
  }
  return null;
}

export function formatBytes(n: number): string {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
