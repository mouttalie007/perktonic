import { describe, expect, test } from "vitest";
import names from "../src/logic/functionNames.json";
import { checkBalance, checkFormula, NEW_FUNCTIONS } from "../src/logic/checks";
import { parseFormula, maxCallDepth } from "../src/logic/parse";
import { separatorStyle, toCommas, toSemicolons } from "../src/logic/separators";

describe("function-name list", () => {
  test("has the required shape and the common functions on every platform", () => {
    expect(Object.keys(names).sort()).toEqual(["excel", "libreoffice", "sheets"]);
    for (const list of [names.excel, names.sheets, names.libreoffice]) {
      expect(list.length).toBeGreaterThan(400);
      for (const fn of ["SUM", "SUMIFS", "INDEX", "MATCH", "VLOOKUP", "IFERROR", "TEXT"]) expect(list).toContain(fn);
    }
    expect(names.sheets).toContain("QUERY");
    expect(names.excel).not.toContain("QUERY");
    expect(names.libreoffice).not.toContain("LAMBDA");
  });

  test("an unknown function gives an 'unverified' warning that names it", () => {
    const c = checkFormula("=SUMIFZ(A1:A9,\">0\")+SUM(B1:B9)", "excel365");
    expect(c.unknownFunctions).toEqual(["SUMIFZ"]);
    expect(c.warnings.find((w) => w.id === "unverified")?.text).toMatch(/SUMIFZ/);
  });

  test("the list depends on the platform: QUERY is fine in Sheets, unverified in Excel", () => {
    const f = '=QUERY(A1:C100,"select A, sum(C) group by A")';
    expect(checkFormula(f, "sheets").warnings).toEqual([]);
    expect(checkFormula(f, "excel365").unknownFunctions).toEqual(["QUERY"]);
  });

  test("names bound by LET and LAMBDA are not reported as unknown functions", () => {
    const c = checkFormula("=LET(double,LAMBDA(v,v*2),total,SUM(A2:A10),double(total))", "excel365");
    expect(c.unknownFunctions).toEqual([]);
  });

  test("Excel's _xlfn. prefix is ignored", () => {
    expect(checkFormula("=_xlfn.XLOOKUP(A2,B:B,C:C)", "excel365").unknownFunctions).toEqual([]);
  });
});

describe("dynamic-array and recent functions", () => {
  const f = '=FILTER(A2:C100,B2:B100="Open")';
  test("warn for Excel 2019 and LibreOffice, not for Excel 365 or Google Sheets", () => {
    expect(checkFormula(f, "excel2019").warnings.map((w) => w.id)).toContain("new-function");
    expect(checkFormula(f, "libreoffice").warnings.find((w) => w.id === "new-function")?.text).toMatch(/LibreOffice 24\.8/);
    expect(checkFormula(f, "excel365").warnings).toEqual([]);
    expect(checkFormula(f, "sheets").warnings).toEqual([]);
  });
  test("the list holds the functions named in the brief", () => {
    for (const fn of ["FILTER", "UNIQUE", "SORT", "SORTBY", "SEQUENCE", "XLOOKUP", "XMATCH", "LET", "LAMBDA", "TEXTSPLIT", "VSTACK", "HSTACK", "TOCOL"]) expect(NEW_FUNCTIONS.has(fn)).toBe(true);
  });
});

describe("brackets and quotes", () => {
  test("a missing and an extra bracket are reported with their position", () => {
    expect(checkBalance("=SUM(A1:A5")).toMatchObject([{ kind: "paren-missing", pos: 4, count: 1 }]);
    expect(checkBalance("=SUM(A1:A5))")).toMatchObject([{ kind: "paren-extra", pos: 11 }]);
  });
  test("brackets and doubled quotes inside text are ignored; an unclosed quote is reported", () => {
    expect(checkBalance('=IF(A1="say ""hi"" (now",1,0)')).toEqual([]);
    expect(checkBalance('=IF(A1="open,1,0)')[0].kind).toBe("quote-open");
  });
  test("a broken formula still gets its functions checked", () => {
    const c = checkFormula("=SUMM(A1:A5", "excel365");
    expect(c.parseError).not.toBeNull();
    expect(c.unknownFunctions).toEqual(["SUMM"]);
    expect(c.warnings.map((w) => w.id)).toEqual(["brackets", "unverified"]);
  });
});

describe("separators", () => {
  test("comma to semicolon converts separators and decimals but not text, sheet names or arrays", () => {
    const f = `=IF(A1>0.5,"a, b",ROUND('Q1, Q2'!B2*1.25,2))+SUM({1,2})`;
    expect(toSemicolons(f)).toBe(`=IF(A1>0,5;"a, b";ROUND('Q1, Q2'!B2*1,25;2))+SUM({1,2})`);
    expect(toCommas(toSemicolons(f))).toBe(f);
  });
  test("the converted formula parses in semicolon mode", () => {
    expect(() => parseFormula(toSemicolons('=SUMIFS(C:C,B:B,"North",A:A,">="&DATE(2026,3,1))'))).not.toThrow();
  });
  test("separator style is detected and semicolons get a warning", () => {
    expect(separatorStyle("=SUM(A1;B1)")).toBe("semicolon");
    expect(separatorStyle("=ROUND(A1;2)+SUM(A1,B1)")).toBe("mixed");
    expect(separatorStyle('=SUM(A1,"x;y")')).toBe("comma");
    expect(checkFormula("=SUM(A1;B1)", "excel365").warnings.map((w) => w.id)).toEqual(["separator"]);
  });
});

describe("parser", () => {
  test("handles sheet names, tables, arrays, spills and LAMBDA calls", () => {
    for (const f of ["='My Sheet'!A1:B2+Table1[Col]+[@Price]*{1,2;3,4}", "=LAMBDA(x,x+1)(5)", "=SUM(A2#)", "=Table1[[#This Row],[Qty]]*2", "=SUM(A1:A5 B1:B5)"]) {
      expect(() => parseFormula(f), f).not.toThrow();
    }
  });
  test("nesting 40 levels deep parses", () => {
    const deep = "=" + "IF(A1>0,".repeat(40) + "1" + ",0)".repeat(40);
    expect(maxCallDepth(parseFormula(deep).ast)).toBe(40);
  });
});
