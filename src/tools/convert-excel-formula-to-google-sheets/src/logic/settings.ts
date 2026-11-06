// No imports: shared by the page and the translator.

export type Platform = "excel" | "sheets" | "calc";
export type Lang = "en" | "fr" | "de" | "es";

export const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "excel", label: "Excel" },
  { id: "sheets", label: "Google Sheets" },
  { id: "calc", label: "LibreOffice Calc" },
];

export const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "es", label: "Spanish" },
];

/** Directions offered, as the brief asks: Excel ↔ Sheets, Excel → Calc, Calc → Excel. */
export const ALLOWED: [Platform, Platform][] = [
  ["excel", "sheets"],
  ["sheets", "excel"],
  ["excel", "calc"],
  ["calc", "excel"],
];

export interface Syntax {
  /** Function names in this language (Google Sheets always uses English names). */
  names: Lang;
  argSep: string;
  decimal: string;
  arrayCol: string;
  arrayRow: string;
  /** "!" for Sheet1!A1, "." for LibreOffice's Sheet1.A1. */
  sheetSep: "!" | ".";
}

export function syntaxOf(platform: Platform, lang: Lang, calcEnglishNames: boolean): Syntax {
  const comma = lang !== "en";
  if (platform === "sheets") {
    // Sheets keeps English names in every locale; comma-decimal locales use ; between arguments and \ between array columns.
    return { names: "en", argSep: comma ? ";" : ",", decimal: comma ? "," : ".", arrayCol: comma ? "\\" : ",", arrayRow: ";", sheetSep: "!" };
  }
  if (platform === "calc") {
    return { names: calcEnglishNames ? "en" : lang, argSep: ";", decimal: comma ? "," : ".", arrayCol: ";", arrayRow: "|", sheetSep: "." };
  }
  return { names: lang, argSep: comma ? ";" : ",", decimal: comma ? "," : ".", arrayCol: comma ? "." : ",", arrayRow: ";", sheetSep: "!" };
}

export const MAX_FORMULA_CHARS = 8192;
