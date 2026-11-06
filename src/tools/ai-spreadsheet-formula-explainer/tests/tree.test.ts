import { describe, expect, test } from "vitest";
import { argumentName, FUNCTION_COUNT, functionInfo } from "../src/logic/functionInfo";
import { analyse, caretWindow, describeReference, describeTable, outline, type TreeNode } from "../src/logic/tree";
import { BROKEN, bigFormula, DEEP_8, MODERN, TRICKY_TEXT } from "../fixtures/formulas";
import { sampleInput } from "../fixtures/sampleInput";

function find(t: TreeNode, pred: (n: TreeNode) => boolean): TreeNode | undefined {
  if (pred(t)) return t;
  for (const c of t.children) {
    const hit = find(c, pred);
    if (hit) return hit;
  }
  return undefined;
}

describe("structure tree (no model)", () => {
  test("a formula nested 8 levels deep gives a tree with names and argument labels", () => {
    const a = analyse(DEEP_8);
    if (!a.ok) throw new Error(a.message);
    expect(a.depth).toBe(9);
    expect(a.root.label).toBe("IFERROR");
    expect(a.root.children.map((c) => c.argName)).toEqual(["value", "value_if_error"]);
    const match = find(a.root, (n) => n.label === "MATCH")!;
    expect(match.children.map((c) => c.argName)).toEqual(["lookup_value", "lookup_array", "match_type"]);
    expect(match.children[1].description).toBe("All of column A on sheet Customers.");
    expect(match.returns).toMatch(/position/);
  });

  test("array constants, table references with special items, LET and LAMBDA", () => {
    const a = analyse(MODERN);
    if (!a.ok) throw new Error(a.message);
    expect(a.root.children.map((c) => c.argName)).toEqual(["name", "value", "name", "value", "calculation"]);
    expect(find(a.root, (n) => n.kind === "array")!.label).toBe("{ array 2×2 }");
    expect(find(a.root, (n) => n.label === "TAX")!.description).toMatch(/LAMBDA named earlier/);
    expect(find(a.root, (n) => n.kind === "table")!.description).toBe("The columns Net to Shipping of table Orders (this row only).");
    expect(find(a.root, (n) => n.label === "x" && n.kind === "name")!.description).toMatch(/parameter of the LAMBDA/);
  });

  test("text with brackets, commas, semicolons and doubled quotes stays one text node", () => {
    const a = analyse(TRICKY_TEXT);
    if (!a.ok) throw new Error(a.message);
    const cond = a.root.children[0];
    expect(cond.children[1]).toMatchObject({ kind: "text", label: '"say ""hi"" (now), ok; really"' });
    expect(a.root.children[2].label).toBe('"a,b"');
  });

  test("invalid formulas report the position, and the caret points at it", () => {
    for (const b of BROKEN) {
      const a = analyse(b.formula);
      expect(a.ok, b.formula).toBe(false);
      if (a.ok) continue;
      expect(a.pos, b.formula).toBe(b.pos);
      expect(a.message, b.formula).toMatch(b.message);
      const w = caretWindow(b.formula, a.pos);
      expect(w.line[w.caret.length - 1]).toBe(b.formula[b.pos]);
    }
  });

  test("8,000 characters with 25 nested levels parses quickly", { timeout: 5000 }, () => {
    const f = bigFormula();
    expect(f.length).toBeGreaterThan(7400);
    expect(f.length).toBeLessThanOrEqual(8000);
    const a = analyse(f);
    if (!a.ok) throw new Error(a.message);
    expect(a.depth).toBe(25);
    expect(a.functionCount).toBeGreaterThan(150);
    expect(outline(a.root).split("\n").length).toBe(a.nodeCount);
  });

  test("a legacy {=...} array formula is read without its outer braces", () => {
    const a = analyse("{=SUM(A1:A3*B1:B3)}");
    expect(a.ok && a.root.label).toBe("SUM");
  });

  test("the sample formula parses and its outline names every function", () => {
    const a = analyse(sampleInput.formula);
    if (!a.ok) throw new Error(a.message);
    const text = outline(a.root);
    for (const fn of ["LET()", "FILTER()", "MONTH()", "IF()", "SUM()", "ROUND()", "AVERAGE()"]) expect(text).toContain(fn);
  });
});

describe("dictionary and descriptions", () => {
  test("at least 120 functions, each with a purpose and a return description", () => {
    expect(FUNCTION_COUNT).toBeGreaterThanOrEqual(120);
    for (const fn of ["SUMIFS", "XLOOKUP", "FILTER", "TEXTJOIN", "QUERY", "LET", "NETWORKDAYS"]) expect(functionInfo(fn)?.purpose, fn).toBeTruthy();
  });
  test("repeating arguments are numbered", () => {
    expect(argumentName("SUMIFS", 3, 5)).toBe("criteria_range2");
    expect(argumentName("SUMIFS", 5, 7)).toBe("criteria_range3");
    expect(argumentName("SUMIFS", 6, 7)).toBe("criteria3");
    expect(argumentName("SUM", 4, 5)).toBe("number5");
    expect(argumentName("XLOOKUP", 3, 4)).toBe("if_not_found");
  });
  test("references and table references are described in words", () => {
    expect(describeReference("'My Sheet'!$A$1:B10")).toBe("Range A1:B10 on sheet My Sheet: 10 rows × 2 columns.");
    expect(describeReference("A2#")).toMatch(/spilled result/);
    expect(describeReference("Sheet1!#REF!")).toMatch(/no longer exists/);
    expect(describeTable("[@Price]")).toBe("The Price value in the same row.");
    expect(describeTable("Table1[Qty]")).toBe("Column Qty of table Table1 (data rows only).");
  });
});
