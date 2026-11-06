import { MAX_BYTES } from "../limits";

/** A PDF starts with "%PDF-" (some producers put a few bytes of junk first; the format allows up to 1 KB). */
export function isPdf(head: Uint8Array): boolean {
  const s = new TextDecoder("latin1").decode(head.subarray(0, 1024));
  return s.includes("%PDF-");
}

export function checkFile(name: string, size: number, head: Uint8Array): string | null {
  if (size === 0) return "This file is empty.";
  if (size > MAX_BYTES) return `The file is larger than ${MAX_BYTES / 1024 / 1024} MB. Split the PDF or choose fewer pages before exporting it.`;
  if (!isPdf(head)) return /\.(png|jpe?g|webp|tiff?)$/i.test(name) ? "This is an image, not a PDF. For photos and scans of a table, use the Scanned Table tool." : "This file is not a PDF (it does not start with %PDF-).";
  return null;
}
