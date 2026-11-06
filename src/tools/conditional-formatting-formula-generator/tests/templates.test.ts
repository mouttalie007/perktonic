import { describe, expect, test } from "vitest";
import { anchorWarnings } from "../src/logic/anchors";
import { parseRange } from "../src/logic/range";
import { buildRule, defaultParams, TEMPLATES, type Params } from "../src/logic/templates";

const build = (id: string, p: Partial<Params> = {}) => {
  const t = TEMPLATES.find((x) => x.id === id)!;
  const r = buildRule(id, { ...defaultParams(t), ...p });
  if (!r.ok) throw new Error(r.error);
  return r.rule;
};

describe("template library", () => {
  test("has at least 20 templates (conditional formatting and data validation), each with steps for Excel and Google Sheets", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(20);
    expect(TEMPLATES.filter((t) => t.kind === "cf").length).toBeGreaterThanOrEqual(15);
    expect(TEMPLATES.filter((t) => t.kind === "dv").length).toBeGreaterThanOrEqual(7);
    for (const t of TEMPLATES) {
      const rule = build(t.id);
      expect(rule.stepsExcel.length, t.id).toBeGreaterThanOrEqual(3);
      expect(rule.stepsSheets.length, t.id).toBeGreaterThanOrEqual(3);
      expect(rule.stepsExcel.join(" "), t.id).toMatch(/Home > Conditional Formatting|Data > Data Validation/);
      expect(rule.stepsSheets.join(" "), t.id).toMatch(/Format > Conditional formatting|Data > Data validation/);
    }
  });

  test("every default formula passes our own anchor check for its range", () => {
    for (const t of TEMPLATES) {
      const rule = build(t.id);
      if (!rule.formula) continue;
      expect(anchorWarnings(rule.formula, parseRange(rule.appliesTo)!), t.id).toEqual([]);
    }
  });

  test("whole rows by one column: =$D2, never =D2 or =$D$2", () => {
    expect(build("row-by-value", { range: "A2:F100", column: "D", value: "Done" }).formula).toBe('=$D2="Done"');
    expect(build("row-by-value", { range: "B5:H40", column: "E", value: "42" }).formula).toBe("=$E5=42");
    expect(build("overdue", { range: "A2:F100", column: "D" }).formula).toBe('=AND($D2<>"",$D2<TODAY())');
  });

  test("duplicates in one column and across several columns use absolute ranges and a relative first cell", () => {
    expect(build("duplicates-column", { range: "B2:B100" }).formula).toBe("=COUNTIF($B$2:$B$100,B2)>1");
    expect(build("duplicates-block", { range: "A2:C100" }).formula).toBe("=COUNTIF($A$2:$C$100,A2)>1");
    expect(build("duplicate-rows", { range: "A2:C50" }).formula).toBe("=COUNTIFS($A$2:$A$50,$A2,$B$2:$B$50,$B2,$C$2:$C$50,$C2)>1");
  });

  test("dates, rankings, banding and text", () => {
    expect(build("due-next-7", { range: "A3:F30", column: "C", n: "7" }).formula).toBe("=AND($C3>=TODAY(),$C3<=TODAY()+7)");
    expect(build("top-percent", { range: "C2:C200", n: "10" }).formula).toBe("=AND(ISNUMBER(C2),C2>=PERCENTILE($C$2:$C$200,0.9))");
    expect(build("banding", { range: "A5:F40" }).formula).toBe("=MOD(ROW()-ROW($A$5),2)=1");
    expect(build("text-contains", { value: 'say "hi"' }).formula).toBe('=ISNUMBER(SEARCH("say ""hi""",B2))');
    expect(build("weekends", { range: "A2:F100", column: "A" }).formula).toBe('=AND($A2<>"",WEEKDAY($A2,2)>5)');
  });

  test("data validation: dropdowns from a range and a list, dates, text patterns", () => {
    const dd = build("dropdown-range", { source: "Lists!A2:A20" });
    expect(dd.formula).toBe("=Lists!$A$2:$A$20");
    expect(dd.stepsSheets.join(" ")).toMatch(/Dropdown \(from a range\)/);
    expect(build("dropdown-range", { source: "'Status list'!B2:B9" }).formula).toBe("='Status list'!$B$2:$B$9");
    expect(build("dropdown-list", { source: "Open, In progress, Done" }).stepsExcel.join(" ")).toMatch(/Source: Open,In progress,Done/);
    expect(build("date-between", { range: "D2:D100", min: "2026-01-01", max: "2026-12-31" }).formula).toBe("=AND(ISNUMBER(D2),D2>=DATE(2026,1,1),D2<=DATE(2026,12,31))");
    expect(build("email-like", { range: "C2:C500" }).formula).toMatch(/^=AND\(LEN\(C2\)-LEN\(SUBSTITUTE\(C2,"@",""\)\)=1/);
    expect(build("no-duplicates", { range: "A2:A500" }).formula).toBe("=COUNTIF($A$2:$A$500,A2)=1");
  });

  test("bad parameters give clear errors", () => {
    const t = TEMPLATES.find((x) => x.id === "row-by-value")!;
    expect(buildRule("row-by-value", { ...defaultParams(t), column: "K" })).toEqual({ ok: false, error: "Column K is outside A2:F100. Pick a column between A and F." });
    expect(buildRule("duplicates-column", { ...defaultParams(t), range: "A2:C9" })).toMatchObject({ ok: false, error: expect.stringMatching(/one column/) });
    expect(buildRule("date-between", { ...defaultParams(t), range: "D2:D9", min: "2026-02-30", max: "2026-12-31" })).toMatchObject({ ok: false, error: "First date is not a real date." });
    expect(buildRule("blanks", { ...defaultParams(t), range: "A:A" })).toMatchObject({ ok: false });
  });
});

describe("anchor check (also used on AI answers)", () => {
  const r = parseRange("A2:F100")!;
  test("flags the classic mistakes", () => {
    expect(anchorWarnings('=D2="Done"', r)[0]).toMatch(/D2 has no \$ before the column/);
    expect(anchorWarnings('=$D$2="Done"', r)[0]).toMatch(/every row of the range tests the same cell/);
    expect(anchorWarnings('=$D3="Done"', r)[0]).toMatch(/does not refer to row 2/);
    expect(anchorWarnings("=COUNTIF(B2:B100,B2)>1", parseRange("B2:B100")!)[0]).toMatch(/moves down one row/);
  });
  test("accepts correct anchors", () => {
    expect(anchorWarnings('=$D2="Done"', r)).toEqual([]);
    expect(anchorWarnings("=MOD(ROW(),2)=0", r)).toEqual([]);
  });
});
