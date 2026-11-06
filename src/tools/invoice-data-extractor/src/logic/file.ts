import { MAX_BYTES } from "../limits";

export type Kind = "jpeg" | "png" | "webp" | "pdf";

/** The real type from the first bytes (the extension is not trusted). */
export function sniff(head: Uint8Array): Kind | null {
  const b = (i: number) => head[i];
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "jpeg";
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b(i) === v)) return "png";
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (new TextDecoder("latin1").decode(head.subarray(0, 1024)).includes("%PDF-")) return "pdf";
  return null;
}

export function checkFile(size: number, head: Uint8Array): { ok: true; kind: Kind } | { ok: false; error: string } {
  if (size === 0) return { ok: false, error: "This file is empty." };
  if (size > MAX_BYTES) return { ok: false, error: `The file is larger than ${MAX_BYTES / 1024 / 1024} MB. Take a smaller photo or crop it to the invoice.` };
  const kind = sniff(head);
  if (!kind) return { ok: false, error: "This file type is not supported. Use a PDF, or a JPG, PNG or WebP photo of the invoice." };
  return { ok: true, kind };
}
