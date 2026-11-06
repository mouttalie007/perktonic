import { describe, expect, it } from "vitest";
import { comparisonCsv, COMPARISON } from "../src/logic/compare";
import { convertAll, ConvertError, extract } from "../src/logic/convert";
import { detectSeparator, parseFormula } from "../src/logic/formula";
import { columns, formatRange, parseRange } from "../src/logic/range";
import { EXAMPLES } from "../fixtures/examples";

const out = (formula: string) => {
  const r = convertAll(formula);
  const by = Object.fromEntries(r.outputs.map((o) => [o.style, o]));
  return { r, x: by.XLOOKUP, im: by["INDEX-MATCH"], v: by.VLOOKUP ?? by.HLOOKUP };
};

describe("parsing", () => {
  it("reads references with sheets, $ signs, whole columns and quoted sheet names", () => {
    expect(formatRange(parseRange("Products!$A$2:$D$500")!)).toBe("Products!$A$2:$D$500");
    expect(formatRange(columns(parseRange("'Price List'!B:E")!, 3)!)).toBe("'Price List'!D:D");
    expect(formatRange(columns(parseRange("$B$2:$E$100")!, 2, 3)!)).toBe("$C$2:$D$100");
    expect(parseRange("Prices")).toBeNull();
  });

  it("detects ; as the argument separator and keeps it", () => {
    expect(detectSeparator('=SVERWEIS(A2;B:C;2;FALSCH)')).toBe(";");
    expect(detectSeparator('=VLOOKUP(A2,{1,2;3,4},2,FALSE)')).toBe(",");
    const { x } = out("=VLOOKUP(A2;$B$2:$C$9;2;FALSE)");
    expect(x.formula).toBe("=XLOOKUP(A2; $B$2:$B$9; $C$2:$C$9)");
  });

  it("explains malformed formulas", () => {
    expect(() => convertAll("=VLOOKUP(A2, B:C, 2")).toThrow(/missing its closing parenthesis/);
    expect(() => convertAll("=SUM(A1:A9)")).toThrow(/No VLOOKUP, HLOOKUP, XLOOKUP or INDEX\/MATCH/);
    expect(() => convertAll('=VLOOKUP("x, B:C, 2, FALSE)')).toThrow(/closing quote/);
    expect(() => convertAll("=VLOOKUP(A2, $B$2:$C$9, 5, FALSE)")).toThrow(/has only 2/);
    expect(() => parseFormula("=" + "A".repeat(9000))).toThrow(/8192/);
  });
});

describe("VLOOKUP", () => {
  it("converts an exact VLOOKUP with IFERROR to all styles", () => {
    const { x, im, v } = out(EXAMPLES[0].formula);
    expect(x.formula).toBe('=XLOOKUP(A2, Products!$A$2:$A$500, Products!$C$2:$C$500, "Not found")');
    expect(x.notes.join(" ")).toMatch(/only replaces “not found”/);
    expect(im.formula).toBe('=IFERROR(INDEX(Products!$C$2:$C$500, MATCH(A2, Products!$A$2:$A$500, 0)), "Not found")');
    expect(v.formula).toBe('=IFERROR(VLOOKUP(A2, Products!$A$2:$D$500, 3, FALSE), "Not found")');
    expect(v.notes[0]).toBe("Your original formula, unchanged.");
  });

  it("keeps approximate match semantics when the 4th argument is TRUE or omitted", () => {
    const { r, x, im, v } = out(EXAMPLES[2].formula);
    expect(r.spec.match).toBe("nextSmaller");
    expect(x.formula).toBe("=XLOOKUP(B5, $H$2:$H$8, $I$2:$I$8, , -1)");
    expect(im.formula).toBe("=INDEX($I$2:$I$8, MATCH(B5, $H$2:$H$8, 1))");
    expect(im.notes.join(" ")).toMatch(/sorted A→Z/);
    expect(v.formula).toBe("=VLOOKUP(B5, $H$2:$I$8, 2)");
    expect(v.notes.join(" ")).toMatch(/sorted A→Z/);
    expect(extract("=VLOOKUP(B5, $H$2:$I$8, 2, TRUE)").spec.match).toBe("nextSmaller");
  });

  it("handles a column number from MATCH, named tables and wildcards", () => {
    const dyn = out("=VLOOKUP($A2, Data!$A:$F, MATCH(B$1, Data!$1:$1, 0), FALSE)");
    expect(dyn.x.formula).toBe("=XLOOKUP($A2, Data!$A:$A, INDEX(Data!$A:$F, 0, MATCH(B$1, Data!$1:$1, 0)))");
    expect(dyn.v.formula).toBe("=VLOOKUP($A2, Data!$A:$F, MATCH(B$1, Data!$1:$1, 0), FALSE)");
    const named = out("=VLOOKUP(A2, Prices, 2, FALSE)");
    expect(named.x.formula).toBe("=XLOOKUP(A2, INDEX(Prices, 0, 1), INDEX(Prices, 0, 2))");
    const wild = out('=VLOOKUP("*Ltd", A2:B50, 2, FALSE)');
    expect(wild.x.formula).toBe('=XLOOKUP("*Ltd", A2:A50, B2:B50, , 2)');
  });

  it("returns several columns from an array of column numbers", () => {
    const { x, im } = out("=VLOOKUP(A2, $A$2:$E$99, {3,4}, FALSE)");
    expect(x.formula).toBe("=XLOOKUP(A2, $A$2:$A$99, $C$2:$D$99)");
    expect(im.formula).toBe("=INDEX($C$2:$D$99, MATCH(A2, $A$2:$A$99, 0), 0)");
    const gap = out("=VLOOKUP(A2, $A$2:$E$99, {2,4}, FALSE)");
    expect(gap.x.formula).toBe("=XLOOKUP(A2, $A$2:$A$99, CHOOSECOLS($A$2:$E$99, 2, 4))");
    expect(gap.x.notes[0]).toMatch(/CHOOSECOLS needs Excel 365/);
    expect(gap.v.formula).toBe("=VLOOKUP(A2, $A$2:$E$99, {2,4}, FALSE)");
    expect(out("=XLOOKUP(A2, A2:A9, B2:C9)").v.formula).toBe("=VLOOKUP(A2, A2:C9, {2,3}, FALSE)");
  });
});

describe("left lookups and XLOOKUP sources", () => {
  it("refuses a VLOOKUP for a left lookup and explains why", () => {
    const { x, im, v } = out(EXAMPLES[1].formula);
    expect(x.formula).toBe("=XLOOKUP(F2, $C$2:$C$200, $A$2:$A$200)");
    expect(im.formula).toBe("=INDEX($A$2:$A$200, MATCH(F2, $C$2:$C$200, 0))");
    expect(v.formula).toBeNull();
    expect(v.impossible).toMatch(/Left lookup/);
  });

  it("turns if_not_found into IFNA and match/search modes into what each style can do", () => {
    const { im, v } = out('=XLOOKUP(A2, B2:B9, D2:D9, "–", -1)');
    expect(im.formula).toBe('=IFNA(INDEX(D2:D9, MATCH(A2, B2:B9, 1)), "–")');
    expect(im.notes.join(" ")).toMatch(/XLOOKUP did not need sorted data/);
    expect(v.formula).toBe('=IFNA(VLOOKUP(A2, B2:D9, 3, TRUE), "–")');
    const last = out("=XLOOKUP(A2, B2:B9, C2:C9, , 0, -1)");
    expect(last.im.impossible).toMatch(/first match/);
    expect(last.v.impossible).toMatch(/first match/);
    expect(out("=XLOOKUP(A2, B2:B9, C2:C9, , 1)").v.impossible).toMatch(/next larger/);
  });

  it("converts INDEX-MATCH back, keeping the formula around the lookup", () => {
    const { r, x, v } = out("=ROUND(INDEX(Sheet2!$D$2:$D$80, MATCH($A3, Sheet2!$B$2:$B$80, 0)) * 1.2, 2)");
    expect(r.embedded).toBe(true);
    expect(x.formula).toBe("=ROUND(XLOOKUP($A3, Sheet2!$B$2:$B$80, Sheet2!$D$2:$D$80) * 1.2, 2)");
    expect(v.formula).toBe("=ROUND(VLOOKUP($A3, Sheet2!$B$2:$D$80, 3, FALSE) * 1.2, 2)");
    expect(() => convertAll("=INDEX(B2:F9, MATCH(A1, A2:A9, 0), MATCH(B1, B1:F1, 0))")).toThrow(ConvertError);
  });
});

describe("HLOOKUP", () => {
  it("converts horizontal lookups and blocks the wrong direction", () => {
    const { x, im, v } = out(EXAMPLES[3].formula);
    expect(x.formula).toBe('=XLOOKUP("Mar", $B$1:$M$1, $B$3:$M$3)');
    expect(im.formula).toBe('=INDEX($B$3:$M$3, MATCH("Mar", $B$1:$M$1, 0))');
    expect(v.style).toBe("HLOOKUP");
    expect(v.formula).toBe('=HLOOKUP("Mar", $B$1:$M$4, 3, FALSE)');
    expect(out("=XLOOKUP(B1, A1:Z1, A5:Z5)").v.formula).toBe("=HLOOKUP(B1, A1:Z5, 5, FALSE)");
  });
});

describe("comparison table", () => {
  it("covers performance, insert safety and compatibility, and exports as CSV", () => {
    const topics = COMPARISON.map((r) => r.topic).join(" | ");
    expect(topics).toMatch(/Speed/);
    expect(topics).toMatch(/inserted/);
    expect(COMPARISON[0].cells.XLOOKUP.text).toMatch(/Not Excel 2019 or 2016/);
    expect(comparisonCsv().split("\r\n")[0]).toBe('"Topic","VLOOKUP / HLOOKUP","INDEX-MATCH","XLOOKUP"');
    expect(out(EXAMPLES[0].formula).x.notes.join(" ")).toMatch(/Not available in Excel 2019 or 2016/);
  });
});
