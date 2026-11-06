export type EncodingId = "utf-8" | "utf-16le" | "utf-16be" | "windows-1256" | "iso-8859-1";
export type EncodingChoice = EncodingId | "auto";

export const ENCODING_LABELS: Record<EncodingId, string> = {
  "utf-8": "UTF-8",
  "utf-16le": "UTF-16 LE",
  "utf-16be": "UTF-16 BE",
  "windows-1256": "Windows-1256 (Arabic)",
  "iso-8859-1": "ISO-8859-1 / Windows-1252 (Western European)",
};

export interface EncodingGuess {
  encoding: EncodingId;
  reason: string;
}

/**
 * Detects UTF-8 (with or without BOM), UTF-16 (BOM), Windows-1256 and
 * ISO-8859-1. Arabic text in Windows-1256 puts its high bytes next to each
 * other (whole words are 0xC1–0xFE), while Western text in ISO-8859-1 uses
 * single accented letters between ASCII ones, so the share of high bytes
 * that have a high-byte neighbour separates the two.
 */
export function detectEncoding(bytes: Uint8Array): EncodingGuess {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { encoding: "utf-8", reason: "UTF-8 byte order mark" };
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { encoding: "utf-16le", reason: "UTF-16 byte order mark" };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { encoding: "utf-16be", reason: "UTF-16 byte order mark" };
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { encoding: "utf-8", reason: "the bytes are valid UTF-8" };
  } catch {
    // Not UTF-8: decide between the two single-byte encodings below.
  }
  let high = 0;
  let paired = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] < 0x80) continue;
    high++;
    if ((i > 0 && bytes[i - 1] >= 0x80) || (i + 1 < bytes.length && bytes[i + 1] >= 0x80)) paired++;
  }
  const share = high === 0 ? 0 : paired / high;
  if (share > 0.5) {
    return { encoding: "windows-1256", reason: `not UTF-8, and ${Math.round(share * 100)}% of non-ASCII bytes form words, typical of Arabic` };
  }
  return { encoding: "iso-8859-1", reason: "not UTF-8, and non-ASCII bytes appear as single accented letters" };
}

export function decodeBytes(bytes: Uint8Array, encoding: EncodingId): string {
  return new TextDecoder(encoding).decode(bytes);
}

// Windows-1252 characters in the 0x80–0x9F range, mapped back to their byte.
const CP1252_REVERSE: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

// A UTF-8 lead byte (shown as Ã, Â, Ø, Ù, â…) followed by a continuation byte shown as Latin-1/1252.
const MOJIBAKE_RE = /[Â-ô][\u0080-¿€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/;

/**
 * Repairs text that was UTF-8 but got decoded as Windows-1252 somewhere
 * upstream ("CafÃ©" → "Café", "Ù…Ø±Ø­Ø¨Ø§" → "مرحبا"). Returns the input
 * unchanged unless the round trip produces valid UTF-8.
 */
export function repairMojibake(value: string): string {
  if (!MOJIBAKE_RE.test(value)) return value;
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x100) bytes[i] = code;
    else if (CP1252_REVERSE[code] !== undefined) bytes[i] = CP1252_REVERSE[code];
    else return value;
  }
  try {
    const fixed = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return fixed !== value ? fixed : value;
  } catch {
    return value;
  }
}
