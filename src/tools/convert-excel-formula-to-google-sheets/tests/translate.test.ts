import { describe, expect, it } from "vitest";
import { FUNCTIONS } from "../src/logic/dictionary";
import { dictionaryStats, FormulaError, translate, type Request } from "../src/logic/translate";
import { EXAMPLES } from "../fixtures/examples";

const t = (formula: string, from: Request["from"], to: Request["to"], fromLang: Request["fromLang"] = "en", toLang: Request["toLang"] = "en", calcEnglishNames = true) => translate({ formula, from, to, fromLang, toLang, calcEnglishNames });

describe("the examples", () => {
  it("French Excel → Google Sheets: localized names, separators and booleans", () => {
    const e = EXAMPLES[0];
    expect(t(e.formula, e.from, e.to, e.fromLang, e.toLang).formula).toBe(`=IF(COUNTIF(Clients!$A$2:$A$500,A2)>0,VLOOKUP(A2,Clients!$A$2:$D$500,4,FALSE),"Inconnu")`);
  });

  it("Google Sheets → Excel: JOIN, REGEXMATCH and open-ended ranges are rewritten, with notes", () => {
    const e = EXAMPLES[1];
    const r = t(e.formula, e.from, e.to);
    expect(r.formula).toBe(`=IFERROR(TEXTJOIN(", ", FALSE, UNIQUE(FILTER(B2:B1048576, REGEXTEST(C2:C1048576, "^EU-")))), "none")`);
    expect(r.notes.join(" ")).toMatch(/Open-ended ranges/);
    expect(r.notes.join(" ")).toMatch(/REGEXTEST needs Microsoft 365 \(2024 release\)/);
    expect(r.functions).toContainEqual({ name: "JOIN", status: "rewritten" });
  });

  it("Excel CSE array formula → LibreOffice: sheet syntax, ; separators, Ctrl+Shift+Enter note", () => {
    const e = EXAMPLES[2];
    const r = t(e.formula, e.from, e.to);
    expect(r.formula).toBe(`=SUM(IF($'Q3 Sales'.B2:B50>100;1;0))`);
    expect(r.notes.join(" ")).toMatch(/Ctrl\+Shift\+Enter/);
  });

  it("LibreOffice → German Excel: LibreOffice-only functions become formulas", () => {
    const e = EXAMPLES[3];
    expect(t(e.formula, e.from, e.to, e.fromLang, e.toLang).formula).toBe(`=TAG(MONATSENDE(A2; 0))+DATEDIF(Data!B2; Data!C2; "m")`);
  });

  it("warns about functions with no equivalent and proposes a workaround", () => {
    const e = EXAMPLES[4];
    const r = t(e.formula, e.from, e.to);
    expect(r.formula).toBe(`=TEXTBEFORE(A2,"@")&" ("&AGGREGATE(9,6,D2:D100)&")"`);
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[0]).toMatch(/^TEXTBEFORE has no equivalent in Google Sheets\. .*REGEXEXTRACT/);
    expect(r.warnings[1]).toMatch(/^AGGREGATE has no equivalent in Google Sheets\. .*SUBTOTAL/);
  });
});

describe("separators, references and literals", () => {
  it("swaps argument and decimal separators and keeps text untouched", () => {
    expect(t(`=ROUND(A1*1.5,2)&"a,b;c"`, "excel", "excel", "en", "fr").formula).toBe(`=ARRONDI(A1*1,5;2)&"a,b;c"`);
    expect(t(`=ARRONDI(A1*1,5;2)`, "excel", "sheets", "fr", "fr").formula).toBe(`=ROUND(A1*1,5;2)`);
    expect(t(`=SUMME(A1:A3;2,5)`, "excel", "excel", "de", "es").formula).toBe(`=SUMA(A1:A3;2,5)`);
  });

  it("converts sheet references between Excel/Sheets (!) and LibreOffice (.)", () => {
    expect(t(`=SUM('My Data'!A1:B5,Totals!C3)`, "excel", "calc").formula).toBe(`=SUM($'My Data'.A1:B5;$Totals.C3)`);
    expect(t(`=SUM($'My Data'.A1:$'My Data'.B5;Totals.C3)`, "calc", "excel").formula).toBe(`=SUM('My Data'!A1:B5,Totals!C3)`);
    expect(t(`=SUM('O''Brien'!A1)`, "excel", "sheets").formula).toBe(`=SUM('O''Brien'!A1)`);
    expect(t(`=[Budget.xlsx]Sheet1!A1`, "excel", "sheets").warnings[0]).toMatch(/IMPORTRANGE/);
  });

  it("localizes booleans, error values and array constants", () => {
    expect(t(`=IF(ISNA(A1),#N/A,TRUE)`, "excel", "excel", "en", "de").formula).toBe(`=WENN(ISTNV(A1);#NV;WAHR)`);
    expect(t(`=SI(A1=#VALEUR!;VRAI;FAUX)`, "excel", "excel", "fr", "es").formula).toBe(`=SI(A1=#¡VALOR!;VERDADERO;FALSO)`);
    expect(t(`=SUM({1,2;3,4})`, "excel", "sheets", "en", "fr").formula).toBe(`=SUM({1\\2;3\\4})`);
    expect(t(`=SUM({1\\2;3\\4})`, "sheets", "excel", "fr", "en").formula).toBe(`=SUM({1,2;3,4})`);
  });
});

describe("arrays and renamed functions", () => {
  it("turns CSE into ARRAYFORMULA for Sheets and removes ARRAYFORMULA for Excel", () => {
    expect(t(`{=SUM(A1:A3*B1:B3)}`, "excel", "sheets").formula).toBe(`=ARRAYFORMULA(SUM(A1:A3*B1:B3))`);
    const back = t(`=ARRAYFORMULA(A2:A10*B2:B10)`, "sheets", "excel");
    expect(back.formula).toBe(`=A2:A10*B2:B10`);
    expect(back.notes.join(" ")).toMatch(/spills array results/);
    expect(t(`=A2:A10*B2:B10`, "excel", "sheets").notes.join(" ")).toMatch(/wrap it in ARRAYFORMULA/);
    expect(t(`=SUM(A2#)`, "excel", "sheets").warnings[0]).toMatch(/spill reference/);
  });

  it("renames functions and rewrites arguments where needed", () => {
    expect(t(`=CONCAT(A1,"-",B1)`, "excel", "sheets").formula).toBe(`=CONCATENATE(A1,"-",B1)`);
    expect(t(`=TEXTSPLIT(A1,", ")`, "excel", "sheets").formula).toBe(`=SPLIT(A1, ", ", FALSE)`);
    expect(t(`=COUNTUNIQUE(A2:A100)`, "sheets", "excel").formula).toBe(`=COUNTA(UNIQUE(A2:A100))`);
    expect(t(`=REGEXMATCH(A1,"^x")`, "sheets", "calc").formula).toBe(`=NOT(ISNA(REGEX(A1; "^x")))`);
    expect(t(`=QUERY(A:D,"select A")`, "sheets", "excel").warnings[0]).toMatch(/^QUERY has no equivalent in Excel/);
    expect(t(`=XLOOKUP(A1,B:B,C:C)`, "excel", "calc").notes[0]).toBe("XLOOKUP needs LibreOffice 24.8 or newer.");
  });
});

describe("errors and the dictionary", () => {
  it("gives clear errors for broken formulas", () => {
    expect(() => t(`=SUM(A1:A3`, "excel", "sheets")).toThrow(/never closed/);
    expect(() => t(`=SUM(A1))`, "excel", "sheets")).toThrow(/without a matching/);
    expect(() => t(`="abc`, "excel", "sheets")).toThrow(FormulaError);
    expect(() => t(`=SOMME(A1;A2)`, "excel", "sheets", "en")).toThrow(/choose a French, German or Spanish source/);
    expect(t(`=MYFUNC(A1)`, "excel", "sheets").warnings[0]).toMatch(/not in the dictionary/);
  });

  it("covers at least 150 functions, each name unique per language", () => {
    const stats = dictionaryStats();
    expect(stats.total).toBeGreaterThanOrEqual(150);
    for (const lang of ["fr", "de", "es"] as const) {
      const seen = new Map<string, string>();
      for (const f of FUNCTIONS) {
        const n = f.names?.[lang];
        if (!n) continue;
        expect(seen.get(n), `${lang} ${n} used by ${seen.get(n)} and ${f.en}`).toBeUndefined();
        seen.set(n, f.en);
      }
    }
    expect(stats.unsupported.sheets).toContain("TEXTBEFORE");
    expect(stats.unsupported.excel).toContain("QUERY");
  });
});
