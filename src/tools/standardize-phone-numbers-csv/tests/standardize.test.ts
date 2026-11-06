import { describe, expect, it } from "vitest";
import { decimalVote, formatAmount, guessColumn, parseAmount, standardizeAmount } from "../src/logic/amounts";
import { standardizeCountry, toAlpha2 } from "../src/logic/country";
import { parseCsv } from "../src/logic/csvParser";
import { standardizeEmail } from "../src/logic/email";
import { guard } from "../src/logic/guard";
import { standardizeName } from "../src/logic/names";
import { standardizePhone } from "../src/logic/phone";
import { applyRules, suggestRule } from "../src/logic/standardize";
import { DEFAULT_OPTIONS, type Outcome } from "../src/logic/types";
import { CONTACTS_CSV, US_AMOUNTS } from "../fixtures/contacts";

const val = (o: Outcome) => (o.kind === "changed" || o.kind === "unchanged" ? o.value : o.kind);

describe("phones", () => {
  it("formats local numbers with the default country, keeps extensions apart and rejects bad ones", () => {
    expect(standardizePhone("07812 345678", "GB")).toEqual({ kind: "changed", value: "+447812345678", extra: undefined });
    expect(standardizePhone("06 12 34 56 78", "FR")).toMatchObject({ kind: "changed", value: "+33612345678" });
    expect(standardizePhone("(212) 555-0147", "US")).toMatchObject({ value: "+12125550147" });
    expect(standardizePhone("+44 20 7946 0958 ext. 204", "US")).toEqual({ kind: "changed", value: "+442079460958", extra: "204" });
    expect(standardizePhone("+212 5 22 12 34 56 x12", "GB")).toMatchObject({ value: "+212522123456", extra: "12" });
    expect(standardizePhone("0044 7812 345679", "FR")).toMatchObject({ value: "+447812345679" });
    expect(standardizePhone("+447812345678", "GB")).toEqual({ kind: "unchanged", value: "+447812345678" });
    expect(standardizePhone("12345", "DE")).toEqual({ kind: "invalid", reason: "too short to be a phone number" });
    expect(standardizePhone("07700 900 123", "GB")).toMatchObject({ kind: "invalid", reason: "has a possible length but is not a valid number for GB" });
    // The same local number means different things in different countries.
    expect(val(standardizePhone("020 794 6095", "NL"))).toBe("+31207946095");
  });
});

describe("emails and names", () => {
  it("trims, lower-cases and checks email syntax only", () => {
    expect(standardizeEmail("  Ada.Lovelace@Example.COM ")).toEqual({ kind: "changed", value: "ada.lovelace@example.com" });
    expect(val(standardizeEmail("mailto:grace@example.org"))).toBe("grace@example.org");
    expect(val(standardizeEmail("Alan Turing <alan@example.net>"))).toBe("alan@example.net");
    expect(val(standardizeEmail("josé+news@correo.españa.es"))).toBe("josé+news@correo.españa.es");
    expect(standardizeEmail("linus@@example.com")).toEqual({ kind: "invalid", reason: "more than one @" });
    expect(standardizeEmail("katherine.example.com")).toEqual({ kind: "invalid", reason: "no @ sign" });
    expect(standardizeEmail("ibn@example")).toEqual({ kind: "invalid", reason: "the domain has no ending such as .com" });
    expect(standardizeEmail("a..b@example.com").kind).toBe("invalid");
    expect(standardizeEmail("")).toEqual({ kind: "empty" });
  });

  it("fixes name casing: McDonald, O'Neil, van der Berg, hyphenated names", () => {
    const cases: [string, string][] = [
      ["MCDONALD", "McDonald"],
      ["o'neil", "O'Neil"],
      ["van der berg", "van der Berg"],
      ["jan VAN DER BERG", "Jan van der Berg"],
      ["JEAN-LUC PICARD", "Jean-Luc Picard"],
      ["fatima al-fihri", "Fatima al-Fihri"],
      ["ibn battuta", "Ibn Battuta"],
      ["maria da silva", "Maria da Silva"],
      ["  ada   LOVELACE ", "Ada Lovelace"],
      ["d'angelo", "D'Angelo"],
    ];
    for (const [input, out] of cases) expect(val(standardizeName(input)), input).toBe(out);
    // Deliberate mixed case is kept.
    expect(standardizeName("DeShawn MacKenzie")).toEqual({ kind: "unchanged", value: "DeShawn MacKenzie" });
    expect(standardizeName("R2-D2").kind).toBe("invalid");
  });
});

describe("amounts and countries", () => {
  it("tells 1.234,56 from 1,234.56 per column and reformats with one currency", () => {
    expect([decimalVote("1.234,56"), decimalVote("1,234.56"), decimalVote("1,234"), decimalVote("1.234.567"), decimalVote("99,9")]).toEqual(["comma", "dot", null, "comma", "comma"]);
    expect(guessColumn(US_AMOUNTS)).toMatchObject({ style: "dot", currency: "USD" });
    expect(guessColumn(["1.234,56 €", "€ 99,90", "2.500"])).toMatchObject({ style: "comma", currency: "EUR", ambiguous: 1 });
    expect(parseAmount("(1,234.56)", "dot")).toEqual({ value: -1234.56, decimals: 2, currency: null });
    expect(parseAmount("12,34", "dot")).toBeNull();
    expect(formatAmount(1234.5, 1, "1.234,56", "EUR", "symbol-after")).toBe("1.234,50 €");
    expect(formatAmount(-1234.56, 2, "1,234.56", "USD", "symbol-before")).toBe("-$1,234.56");
    expect(formatAmount(1234.56, 2, "1234.56", "MAD", "code-before")).toBe("MAD 1234.56");
    expect(standardizeAmount("$40,00", "comma", "EUR", "1234.56", "code-before")).toEqual({ kind: "invalid", reason: "in USD, not EUR; currencies are not converted" });
    expect(val(standardizeAmount("EUR 1.000,00", "comma", "EUR", "1,234.56", "code-before"))).toBe("EUR 1,000.00");
  });

  it("unifies country names in four languages and codes to ISO 3166", () => {
    for (const [input, a2] of [
      ["Allemagne", "DE"],
      ["Deutschland", "DE"],
      ["Marruecos", "MA"],
      ["Maroc", "MA"],
      ["UK", "GB"],
      ["england", "GB"],
      ["USA", "US"],
      ["FRA", "FR"],
      ["fr", "FR"],
      ["Côte d’Ivoire", "CI"],
      ["Österreich", "AT"],
      ["Pays-Bas", "NL"],
    ]) expect(toAlpha2(input), input).toBe(a2);
    expect(val(standardizeCountry("Marruecos", "alpha3"))).toBe("MAR");
    expect(val(standardizeCountry("deutschland", "name"))).toBe("Germany");
    expect(standardizeCountry("Narnia", "alpha2")).toEqual({ kind: "invalid", reason: "not a recognised country name or ISO code" });
  });
});

describe("the whole file", () => {
  it("suggests rules, counts changes per column and lists invalid values with their line, never dropping them", () => {
    const rows = parseCsv(CONTACTS_CSV, ",").rows.filter((r) => r.length > 1);
    const [header, ...data] = rows;
    const rules = header.map((h, i) => ({ rule: suggestRule(h, data.map((r) => r[i])) }));
    expect(rules.map((r) => r.rule)).toEqual(["name", "email", "phone", "country", "amount"]);
    const res = applyRules(header, data, rules, { ...DEFAULT_OPTIONS, phoneCountryColumn: 3, amountOutput: "1.234,56", currencyLabel: "symbol-after", currency: "auto" });
    expect(res.header).toEqual(["name", "email", "phone", "phone_ext", "country", "balance"]);
    expect(res.rows).toHaveLength(12);
    expect(res.rows[1]).toEqual(["O'Neil", "grace.hopper@example.org", "+442079460958", "204", "GB", "99,90 €"]);
    expect(res.stats.map((s) => [s.column, s.changed, s.unchanged, s.invalid])).toEqual([
      ["name", 10, 2, 0],
      ["email", 4, 6, 2],
      ["phone", 10, 0, 2],
      ["country", 11, 0, 1],
      ["balance", 8, 3, 1],
    ]);
    expect(res.stats[4].note).toBe("Detected 1.234,56 from 11 values; 1 could be read either way; currency EUR (most common)");
    expect(res.invalid.map((e) => [e.row, e.column, e.value])).toEqual([
      [10, "email", "linus@@example.com"],
      [10, "phone", "12345"],
      [10, "balance", "$40,00"],
      [11, "email", "ibn.battuta@example"],
      [13, "phone", "07700 900 123"],
      [13, "country", "Narnia"],
    ]);
    // Invalid values stay in the output exactly as they were.
    expect(res.rows[11][2]).toBe("07700 900 123");
    expect(res.rows[11][4]).toBe("Narnia");
  });

  it("guards against spreadsheet formulas without breaking phones or negative amounts", () => {
    expect([guard("=SUM(A1)"), guard("+cmd|calc"), guard("@x"), guard("+447812345678"), guard("-45,00 €"), guard("-2+3")]).toEqual(["'=SUM(A1)", "'+cmd|calc", "'@x", "+447812345678", "-45,00 €", "'-2+3"]);
  });

  it("suggests rules from the values when headers say nothing, and handles 100,000 rows", () => {
    expect(suggestRule("col_a", ["ada@example.com", "grace@example.org"])).toBe("email");
    expect(suggestRule("col_b", ["+44 20 7946 0958", "06 12 34 56 78", "(212) 555-0147"])).toBe("phone");
    expect(suggestRule("Company name", ["Acme"])).toBe("none");
    const data = Array.from({ length: 100_000 }, (_, i) => [i % 2 ? "ADA LOVELACE" : "grace hopper", ` User${i}@Example.com`, `07812 ${String(345000 + (i % 999)).padStart(6, "0")}`, i % 2 ? "UK" : "Allemagne"]);
    const res = applyRules(["name", "email", "phone", "country"], data, ["name", "email", "phone", "country"].map((rule) => ({ rule: rule as "name" })), DEFAULT_OPTIONS);
    expect(res.rows).toHaveLength(100_000);
    expect(res.rows[1]).toEqual(["Ada Lovelace", "user1@example.com", "+447812345001", "", "GB"]);
    expect(res.stats[2].changed + res.stats[2].invalid).toBe(100_000);
  }, 30_000);
});
