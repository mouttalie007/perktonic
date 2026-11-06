// No imports: shared by the page, the workers and the logic.

export type Category = "email" | "url" | "phone" | "date" | "amount" | "hashtag" | "mention" | "ipv4" | "ipv6" | "iban";

export const CATEGORIES: { id: Category; label: string; dedupeRule: string }[] = [
  { id: "email", label: "Emails", dedupeRule: "case-insensitive" },
  { id: "url", label: "URLs", dedupeRule: "host case-insensitive, path case-sensitive" },
  { id: "phone", label: "Phone numbers", dedupeRule: "same number in E.164 form" },
  { id: "date", label: "Dates", dedupeRule: "same calendar date" },
  { id: "amount", label: "Money amounts", dedupeRule: "same currency and value" },
  { id: "hashtag", label: "Hashtags", dedupeRule: "case-insensitive" },
  { id: "mention", label: "@mentions", dedupeRule: "case-insensitive" },
  { id: "ipv4", label: "IPv4 addresses", dedupeRule: "exact" },
  { id: "ipv6", label: "IPv6 addresses", dedupeRule: "same address after compression" },
  { id: "iban", label: "IBAN-like numbers", dedupeRule: "spaces and case ignored" },
];

export interface Entity {
  /** As written in the text. */
  value: string;
  /** Standard form: lower-case domain, E.164 phone, ISO date, "EUR 12.50"… */
  normalized: string;
  /** How many times it appears (1 when de-duplication is off). */
  count: number;
  /** First position in the text. */
  index: number;
  /** About 30 characters on each side, for context. */
  context: string;
  note: string | null;
}

export interface Options {
  /** Default country for numbers without a + prefix (ISO 3166 code). */
  country: string;
  /** For 03/04/2026: day first (3 April) or month first (March 4). */
  dayFirst: boolean;
  dedupe: boolean;
}

export const MAX_PASTE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const CUSTOM_TIMEOUT_MS = 1500;
export const COUNTRIES = ["US", "GB", "CA", "AU", "IE", "FR", "DE", "ES", "IT", "NL", "BE", "CH", "AT", "SE", "PL", "PT", "IN", "BR", "MX", "ZA", "JP", "SG", "AE", "MA", "DZ", "TN", "EG", "SA"];
