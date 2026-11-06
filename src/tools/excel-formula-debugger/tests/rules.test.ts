import { describe, expect, test } from "vitest";
import { diff } from "../src/logic/diff";
import { closestFunction, diagnose, ERROR_KINDS, parseArea, RULES, type DebugInput } from "../src/logic/rules";

const top = (formula: string, error: DebugInput["error"], extra: Partial<DebugInput> = {}) => diagnose({ formula, error, platform: "excel365", ...extra });
const ids = (formula: string, error: DebugInput["error"], extra: Partial<DebugInput> = {}) => top(formula, error, extra).map((f) => f.id);

describe("rule engine", () => {
  test("has at least 20 rules with unique ids, and every error kind is covered", () => {
    expect(RULES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
    for (const e of ERROR_KINDS) expect(RULES.some((r) => r.errors === "any" || r.errors.includes(e)), e).toBe(true);
  });

  test("#VALUE!: text in arithmetic, numbers stored as text, mismatched sizes", () => {
    expect(ids('="abc"*2', "#VALUE!")[0]).toBe("text-in-arithmetic");
    expect(ids("=B2+C2", "#VALUE!")).toContain("number-stored-as-text");
    const m = top('=SUMIFS(C2:C100,A2:A99,"x")', "#VALUE!")[0];
    expect(m).toMatchObject({ id: "mismatched-sizes", level: "High" });
  });

  test("#REF!: a column number beyond the table and a literal #REF!", () => {
    const f = top("=VLOOKUP(A2,Products!A2:C200,4)", "#REF!")[0];
    expect(f.id).toBe("column-index-out-of-range");
    expect(f.cause).toMatch(/only 3 columns/);
    expect(ids("=SUM(#REF!,B2)", "#REF!")[0]).toBe("literal-ref-error");
  });

  test("#N/A: approximate match gets a mechanical fix; INDEX/MATCH ranges that do not line up", () => {
    const f = top("=VLOOKUP(A2,Products!A2:C200,3)", "#N/A")[0];
    expect(f).toMatchObject({ id: "approximate-match", corrected: "=VLOOKUP(A2,Products!A2:C200,3,FALSE)" });
    expect(top("=MATCH(A2,B:B,1)", "#N/A")[0].corrected).toBe("=MATCH(A2,B:B,0)");
    expect(ids("=INDEX(C2:C50,MATCH(A2,B3:B60,0))", "#N/A")[0]).toBe("misaligned-ranges");
    expect(top('=VLOOKUP("1001",A:B,2,FALSE)', "#N/A")[0]).toMatchObject({ id: "number-stored-as-text", corrected: "=VLOOKUP(1001,A:B,2,FALSE)" });
  });

  test("#NAME?: smart quotes, typos, missing colon, unquoted text, a function too new", () => {
    expect(top("=IF(A1=“Yes”,1,0)", "#NAME?")[0]).toMatchObject({ id: "smart-quotes", corrected: '=IF(A1="Yes",1,0)' });
    expect(top("=SUMM(A1:A10)", "#NAME?")[0]).toMatchObject({ id: "unknown-function", corrected: "=SUM(A1:A10)" });
    expect(top("=SUM(A1A10)", "#NAME?")[0]).toMatchObject({ id: "missing-colon", corrected: "=SUM(A1:A10)" });
    expect(top("=IF(A1=Yes,1,0)", "#NAME?")[0]).toMatchObject({ id: "text-without-quotes", corrected: '=IF(A1="Yes",1,0)' });
    expect(ids("=XLOOKUP(A2,B:B,C:C)", "#NAME?", { platform: "excel2019" })).toContain("function-too-new");
    expect(closestFunction("VLOKUP", "excel365")).toBe("VLOOKUP");
  });

  test("#DIV/0!: the divisor is tested (not hidden with IFERROR); AVERAGE with no numbers", () => {
    const f = top("=A2/B2", "#DIV/0!")[0];
    expect(f).toMatchObject({ id: "division-by-empty", corrected: '=IF(B2=0,"",A2/B2)' });
    expect(f.corrected).not.toMatch(/IFERROR/);
    expect(ids('=AVERAGEIFS(C:C,A:A,"North")', "#DIV/0!")[0]).toBe("average-of-nothing");
  });

  test("#NUM!, #NULL!, #SPILL!, ### and circular references", () => {
    expect(ids("=IRR(B2:B10)", "#NUM!")[0]).toBe("num-invalid-math");
    expect(top("=SUM(A1:A5 B1:B5)", "#NULL!")[0].corrected).toBe("=SUM(A1:A5,B1:B5)");
    expect(ids('=FILTER(A:A,B:B="x")', "#SPILL!")).toEqual(["spill-blocked", "spill-whole-column"]);
    expect(ids("=B2-A2", "###")).toEqual(["column-too-narrow", "negative-date-time"]);
    expect(top("=SUM(C2:C11)", "circular", { cell: "C11" })).toMatchObject([{ id: "self-reference", level: "High" }]);
    expect(ids("=SUM(C2:C10)", "circular", { cell: "C11" })).toEqual(["circular-chain"]);
    expect(ids("=SUM(C:C)", "circular")[0]).toBe("whole-column-circular");
  });

  test("locale separators and brackets apply to any error, with mechanical fixes", () => {
    expect(top('=SUMIF(A2:A9;"x";B2:B9)', "#NAME?")[0]).toMatchObject({ id: "separator-mismatch", corrected: '=SUMIF(A2:A9,"x",B2:B9)' });
    expect(top("=ROUND(A1;2)+SUM(B1,B2)", "#VALUE!")[0]).toMatchObject({ id: "separator-mismatch", level: "High" });
    expect(top("=SUM(A1:A3", "#VALUE!")[0]).toMatchObject({ id: "unbalanced-brackets", corrected: "=SUM(A1:A3)" });
    expect(top("=SUM(A1:A3))", "#N/A")[0]).toMatchObject({ id: "unbalanced-brackets", corrected: "=SUM(A1:A3)" });
  });

  test("results are ranked by confidence", () => {
    const r = top("=VLOOKUP(A2,B2:C10,2)", "#N/A");
    expect(r.map((x) => x.score)).toEqual([...r.map((x) => x.score)].sort((a, b) => b - a));
  });
});

describe("helpers", () => {
  test("parseArea expands whole columns and reads sheets", () => {
    expect(parseArea("'My Sheet'!$B$2:D10")).toEqual({ sheet: "My Sheet", c1: 2, c2: 4, r1: 2, r2: 10 });
    expect(parseArea("A:A")).toMatchObject({ c1: 1, c2: 1, r1: 1, r2: 1048576 });
  });
  test("diff marks only the changed words", () => {
    expect(diff("=VLOOKUP(A2,Products!A2:C200,4)", "=VLOOKUP(A2,Products!A2:D200,4,FALSE)")).toEqual([
      { type: "same", text: "=VLOOKUP(A2,Products!A2:" },
      { type: "del", text: "C200" },
      { type: "add", text: "D200" },
      { type: "same", text: ",4" },
      { type: "add", text: ",FALSE" },
      { type: "same", text: ")" },
    ]);
  });
});
