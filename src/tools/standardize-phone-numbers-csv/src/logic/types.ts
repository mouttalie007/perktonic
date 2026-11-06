// No imports: shared by the page, the worker and the logic.

export type Rule = "none" | "phone" | "email" | "name" | "amount" | "country";

export const RULES: { id: Rule; label: string }[] = [
  { id: "none", label: "Leave as is" },
  { id: "phone", label: "Phone → E.164" },
  { id: "email", label: "Email → trim, lower-case, check" },
  { id: "name", label: "Person name → capitalisation" },
  { id: "amount", label: "Amount → one currency format" },
  { id: "country", label: "Country → ISO 3166" },
];

export type DecimalStyle = "dot" | "comma";
export type AmountOutput = "1234.56" | "1,234.56" | "1.234,56" | "1 234,56";
export type CurrencyLabel = "symbol-before" | "symbol-after" | "code-before" | "none";
export type CountryOutput = "alpha2" | "alpha3" | "name";

export interface ColumnRule {
  rule: Rule;
  /** Amounts: how to read the input; "auto" uses the per-column guess. */
  decimal?: DecimalStyle | "auto";
}

export interface Options {
  /** ISO alpha-2 country for phone numbers written without +. */
  phoneCountry: string;
  /** Index of a column holding each row's country, used for local numbers instead of phoneCountry; -1 = none. */
  phoneCountryColumn: number;
  amountOutput: AmountOutput;
  currency: string;
  currencyLabel: CurrencyLabel;
  countryOutput: CountryOutput;
  bom: boolean;
}

export const DEFAULT_OPTIONS: Options = {
  phoneCountry: "GB",
  phoneCountryColumn: -1,
  amountOutput: "1234.56",
  currency: "auto",
  currencyLabel: "code-before",
  countryOutput: "alpha2",
  bom: false,
};

/** What a rule did to one value. */
export type Outcome = { kind: "empty" } | { kind: "unchanged"; value: string } | { kind: "changed"; value: string; extra?: string } | { kind: "invalid"; reason: string; extra?: string };

export interface ColumnStats {
  column: string;
  rule: Rule;
  changed: number;
  unchanged: number;
  invalid: number;
  empty: number;
  /** For amounts: the detected style and currency, in words. */
  note: string | null;
}

export interface InvalidEntry {
  /** Line in the file, counting the header as line 1. */
  row: number;
  column: string;
  value: string;
  reason: string;
}

export const MAX_INVALID_KEPT = 100_000;
export const PHONE_COUNTRIES = ["US", "GB", "CA", "AU", "IE", "FR", "DE", "ES", "IT", "NL", "BE", "CH", "AT", "SE", "NO", "DK", "PL", "PT", "IN", "BR", "MX", "ZA", "JP", "SG", "AE", "MA", "DZ", "TN", "EG", "SA", "NG", "KE"];
