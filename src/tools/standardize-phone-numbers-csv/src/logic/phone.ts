import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";
import type { Outcome } from "./types";

/**
 * Formats a phone number as E.164 (+447700900123). Numbers without + use the
 * row's country, then the default country. An extension ("ext. 204", "x204")
 * is returned separately so it can go to its own column.
 */
export function standardizePhone(raw: string, country: string): Outcome {
  const trimmed = raw.trim();
  if (trimmed === "") return { kind: "empty" };
  // "00" is the international prefix in most countries; libphonenumber only reads it for the default country.
  const input = trimmed.replace(/^\s*00(?=[1-9])/, "+").replace(/^tel:/i, "");
  if (!/\d/.test(input)) return { kind: "invalid", reason: "has no digits" };
  // Very short entries are usually internal extensions or typos, even where the country's plan allows them.
  if (input.replace(/(?:ext\.?|x|#)\s*\d+\s*$/i, "").replace(/\D/g, "").length < 6) return { kind: "invalid", reason: "too short to be a phone number" };
  let p;
  try {
    p = parsePhoneNumberFromString(input, { defaultCountry: country as CountryCode, extract: false });
  } catch {
    p = undefined;
  }
  if (!p) {
    const digits = input.replace(/\D/g, "").length;
    return { kind: "invalid", reason: digits < 6 ? "too short to be a phone number" : input.startsWith("+") ? "unknown country code" : `not a number for ${country}; add the country code (+…)` };
  }
  const ext = p.ext ? String(p.ext) : undefined;
  if (!p.isValid()) {
    return { kind: "invalid", reason: p.isPossible() ? `has a possible length but is not a valid number for ${p.country ?? country}` : `wrong length for a number from ${p.country ?? country}`, extra: ext };
  }
  const value = p.number;
  return value === trimmed && !ext ? { kind: "unchanged", value } : { kind: "changed", value, extra: ext };
}
