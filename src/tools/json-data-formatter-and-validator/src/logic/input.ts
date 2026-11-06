export const MAX_PASTE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export type FileCheck = { ok: true } | { ok: false; error: string };

/** Size and magic-byte check before a file is read; `head` is its first bytes. */
export function checkFile(head: Uint8Array, size: number): FileCheck {
  if (size === 0) return { ok: false, error: "This file is empty." };
  if (size > MAX_FILE_BYTES) return { ok: false, error: `This file is ${(size / 1048576).toFixed(1)} MB; the limit is 50 MB.` };
  const starts = (sig: number[]) => sig.every((b, i) => head[i] === b);
  if (starts([0x50, 0x4b, 0x03, 0x04])) return { ok: false, error: "This is a ZIP or Office file, not JSON. Unzip it first." };
  if (starts([0x1f, 0x8b])) return { ok: false, error: "This is a gzip-compressed file. Decompress it first (it usually ends in .json.gz)." };
  if (starts([0x25, 0x50, 0x44, 0x46]) || starts([0x89, 0x50, 0x4e, 0x47]) || starts([0xff, 0xd8, 0xff])) return { ok: false, error: "This is a PDF or an image, not a JSON file." };
  const utf16 = starts([0xff, 0xfe]) || starts([0xfe, 0xff]);
  if (!utf16 && head.includes(0)) return { ok: false, error: "This file contains binary data, so it is not JSON text." };
  return { ok: true };
}

/** UTF-8 (BOM removed) or UTF-16 with a BOM; JSON files must be Unicode (RFC 8259). */
export function decodeJsonBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  return new TextDecoder("utf-8").decode(bytes);
}
