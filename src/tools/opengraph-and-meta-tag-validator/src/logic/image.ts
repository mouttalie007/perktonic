export type ImageType = "jpeg" | "png" | "gif" | "webp" | "svg" | "avif" | "unknown";

export interface ImageInfo {
  type: ImageType;
  width: number | null;
  height: number | null;
}

const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u24le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));

/**
 * Reads the type and pixel size from the first bytes of an image, the way
 * crawlers do, without decoding it (so no native dependency such as sharp is
 * needed and a truncated download is enough for most files).
 */
export function readImageInfo(b: Uint8Array): ImageInfo {
  if (b.length >= 24 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG") {
    return { type: "png", width: u32be(b, 16), height: u32be(b, 20) };
  }
  if (b.length >= 10 && ascii(b, 0, 3) === "GIF") return { type: "gif", width: u16le(b, 6), height: u16le(b, 8) };
  if (b.length >= 30 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") {
    const chunk = ascii(b, 12, 4);
    if (chunk === "VP8X") return { type: "webp", width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
    if (chunk === "VP8L") {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { type: "webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8 ") return { type: "webp", width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
    return { type: "webp", width: null, height: null };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) {
        o++;
        continue;
      }
      const marker = b[o + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        o += 2;
        continue;
      }
      // SOF0–SOF15 except DHT (C4), JPG (C8) and DAC (CC) carry the frame size.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { type: "jpeg", width: u16be(b, o + 7), height: u16be(b, o + 5) };
      }
      o += 2 + u16be(b, o + 2);
    }
    return { type: "jpeg", width: null, height: null };
  }
  if (b.length >= 12 && ascii(b, 4, 4) === "ftyp" && /avif|avis/.test(ascii(b, 8, 4))) return { type: "avif", width: null, height: null };
  const head = new TextDecoder().decode(b.subarray(0, 512)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return { type: "svg", width: null, height: null };
  return { type: "unknown", width: null, height: null };
}

export const MIME: Record<ImageType, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
  unknown: "application/octet-stream",
};
