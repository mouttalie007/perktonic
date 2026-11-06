import countries from "i18n-iso-countries";
import de from "i18n-iso-countries/langs/de.json";
import en from "i18n-iso-countries/langs/en.json";
import es from "i18n-iso-countries/langs/es.json";
import fr from "i18n-iso-countries/langs/fr.json";
import type { CountryOutput, Outcome } from "./types";

for (const l of [en, fr, es, de]) countries.registerLocale(l);

/** Names people write that are not in the ISO lists. Parts of the United Kingdom map to GB. */
const ALIASES: Record<string, string> = {
  england: "GB", scotland: "GB", wales: "GB", "northern ireland": "GB", "great britain": "GB", "u.k.": "GB", "uk": "GB", "angleterre": "GB",
  holland: "NL", "the netherlands": "NL", "pays-bas": "NL", "hollande": "NL",
  "u.s.": "US", "u.s.a.": "US", "usa": "US", "america": "US", "etats-unis": "US", "eeuu": "US", "ee.uu.": "US",
  "ivory coast": "CI", "cote d'ivoire": "CI", "côte d'ivoire": "CI",
  "south korea": "KR", "north korea": "KP", "russia": "RU", "czechia": "CZ", "turkey": "TR", "türkiye": "TR", "vietnam": "VN", "uae": "AE", "emirates": "AE",
};

/** ISO 3166 alpha-2 code for a code or a name in English, French, Spanish or German. */
export function toAlpha2(raw: string): string | null {
  const v = raw.trim().replace(/[’`´]/g, "'").replace(/\s+/g, " ");
  if (v === "") return null;
  if (/^[A-Za-z]{2}$/.test(v) && countries.isValid(v.toUpperCase())) return v.toUpperCase();
  if (/^[A-Za-z]{3}$/.test(v)) {
    const a2 = countries.alpha3ToAlpha2(v.toUpperCase());
    if (a2) return a2;
  }
  const lower = v.toLowerCase().replace(/^the /, "");
  if (ALIASES[lower]) return ALIASES[lower];
  for (const lang of ["en", "fr", "es", "de"]) {
    const code = countries.getAlpha2Code(v, lang);
    if (code) return code;
  }
  return null;
}

export function standardizeCountry(raw: string, out: CountryOutput): Outcome {
  if (raw.trim() === "") return { kind: "empty" };
  const a2 = toAlpha2(raw);
  if (!a2) return { kind: "invalid", reason: "not a recognised country name or ISO code" };
  const value = out === "alpha2" ? a2 : out === "alpha3" ? (countries.alpha2ToAlpha3(a2) ?? a2) : (countries.getName(a2, "en", { select: "official" }) ?? a2);
  return value === raw ? { kind: "unchanged", value } : { kind: "changed", value };
}
