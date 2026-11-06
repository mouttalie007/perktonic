export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_PASTE_BYTES = 5 * 1024 * 1024;

export type FileCheck = { ok: true } | { ok: false; error: string };

/** Size and magic-byte check; `head` is the file's first bytes. */
export function checkFile(head: Uint8Array, size: number): FileCheck {
  if (size === 0) return { ok: false, error: "This file is empty." };
  if (size > MAX_FILE_BYTES) return { ok: false, error: `This file is ${(size / 1048576).toFixed(1)} MB. The limit is 50 MB.` };
  const starts = (sig: number[]) => sig.every((b, i) => head[i] === b);
  if (starts([0x50, 0x4b, 0x03, 0x04])) return { ok: false, error: "This is an Excel (.xlsx) or ZIP file. Save the sheet as CSV first (File → Save As → CSV UTF-8)." };
  if (starts([0xd0, 0xcf, 0x11, 0xe0])) return { ok: false, error: "This is an old Excel (.xls) file. Save it as CSV first." };
  if (starts([0x25, 0x50, 0x44, 0x46])) return { ok: false, error: "This is a PDF, not a CSV file." };
  if (starts([0x1f, 0x8b])) return { ok: false, error: "This file is gzip-compressed. Decompress it first." };
  if (starts([0x89, 0x50, 0x4e, 0x47]) || starts([0xff, 0xd8, 0xff])) return { ok: false, error: "This is an image, not a CSV file." };
  const utf16 = starts([0xff, 0xfe]) || starts([0xfe, 0xff]);
  if (!utf16 && head.includes(0)) return { ok: false, error: "This file contains binary data, so it is not a CSV file." };
  return { ok: true };
}
