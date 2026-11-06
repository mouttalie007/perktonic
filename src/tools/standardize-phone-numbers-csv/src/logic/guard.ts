/**
 * A cell that starts with = + - @ is run as a formula by spreadsheets, which
 * attackers abuse ("CSV injection"). Such cells get a leading apostrophe,
 * except plain numbers and phone numbers (+44…, -45,00 €), which are safe.
 */
export function guard(v: string): string {
  if (!/^[=+\-@\t\r]/.test(v)) return v;
  if (/^[+-]?\d[\d\s().,]*(\s?[^\s\d=+@(][^=(]*)?$/.test(v) && !/[=(]/.test(v.slice(1).replace(/^\d[\d\s().,]*/, ""))) return v;
  return `'${v}`;
}
