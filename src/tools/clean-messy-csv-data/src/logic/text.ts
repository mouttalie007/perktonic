// Zero-width space, word joiner, BOM, soft hyphen, Mongolian vowel separator,
// bidi embedding/override controls and C0/C1 control characters (tab, CR, LF kept).
// ZWNJ (U+200C) and ZWJ (U+200D) are kept on purpose: Persian, Arabic, Hindi and emoji need them.
const INVISIBLE_RE = /[​⁠﻿­᠎‪-‮⁦-⁩\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;

// No-break, figure, narrow no-break, ideographic and the fixed-width spaces.
const ODD_SPACE_RE = /[   -   　]/g;

const DOUBLE_QUOTES_RE = /[“”„‟″«»]/g;
const SINGLE_QUOTES_RE = /[‘’‚‛′]/g;

export function removeInvisible(value: string): string {
  return value.replace(INVISIBLE_RE, "");
}

export function normalizeSpaces(value: string): string {
  return value.replace(ODD_SPACE_RE, " ");
}

/** Curly quotes become straight ones. Guillemets « » are left alone unless `guillemets` is set. */
export function straightenQuotes(value: string, guillemets = false): string {
  let v = value.replace(SINGLE_QUOTES_RE, "'");
  v = guillemets ? v.replace(DOUBLE_QUOTES_RE, "\"") : v.replace(/[“”„‟″]/g, "\"");
  return v;
}

export function trimCell(value: string, collapse: boolean): string {
  const t = value.trim();
  return collapse ? t.replace(/[ \t]{2,}/g, " ") : t;
}

const NAMED: Record<number, string> = {
  0x00a0: "NBSP",
  0x200b: "ZWSP",
  0x200c: "ZWNJ",
  0x200d: "ZWJ",
  0x2060: "WJ",
  0xfeff: "BOM",
  0x00ad: "SHY",
  0x202f: "NNBSP",
  0x0009: "TAB",
};

/**
 * Makes whitespace and invisible characters visible for the change report,
 * e.g. " Acme​ " → "·Acme⟨ZWSP⟩·", so a before/after pair never looks identical.
 */
export function visible(value: string): string {
  if (value === "") return "∅ (empty)";
  let out = "";
  const chars = Array.from(value);
  chars.forEach((ch, i) => {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === " " && (i === 0 || i === chars.length - 1 || chars[i - 1] === " " || chars[i + 1] === " ")) out += "·";
    else if (ch === "\n") out += "⏎";
    else if (ch === "\r") out += "";
    else if (NAMED[code]) out += `⟨${NAMED[code]}⟩`;
    else if (code < 0x20 || (code >= 0x7f && code <= 0x9f) || (code >= 0x2000 && code <= 0x200f) || (code >= 0x2028 && code <= 0x206f && code !== 0x2030)) {
      if (/[‐-‧‰-⁞]/.test(ch)) out += ch;
      else out += `⟨U+${code.toString(16).toUpperCase().padStart(4, "0")}⟩`;
    } else out += ch;
  });
  return out;
}
