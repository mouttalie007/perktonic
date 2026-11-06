import { describe, expect, it } from "vitest";
import { buildPreviewQuery, buildQuery, BuildError, literalFor, queryString, toFormula, type BuilderState } from "../src/logic/builder";
import { buildTable, firstColumnOf, parseGrid } from "../src/logic/data";
import { runQuery } from "../src/logic/evaluate";
import { parseQuery, QueryError } from "../src/logic/query";
import { formatValue } from "../src/logic/values";
import { EXAMPLE_RANGE, SALES_TSV } from "../fixtures/sales";

const table = (text = SALES_TSV, headerRows: 0 | 1 | 2 = 1, firstColumn = "A", colNotation = false) => buildTable(parseGrid(text), { headerRows, firstColumn, colNotation });
const rows = (q: string, t = table()) => {
  const r = runQuery(t, q);
  return { headers: r.headers, rows: r.rows.map((row) => row.map(formatValue)) };
};
const base: BuilderState = { range: EXAMPLE_RANGE, headerRows: 1, colNotation: false, select: [], filters: [], groupBy: [], pivot: "", orderBy: [], limit: "", offset: "" };

describe("columns and header rows", () => {
  it("names columns by letter and types them from the data", () => {
    const t = table();
    expect(t.columns.map((c) => `${c.id}:${c.label}:${c.type}`)).toEqual(["A:Date:date", "B:Region:string", "C:Rep:string", "D:Product:string", "E:Units:number", "F:Revenue:number"]);
    expect(t.rows).toHaveLength(24);
  });

  it("changes naming with 0, 1 or 2 header rows, the range start and Col notation", () => {
    const grid = "Q1\tQ1\nRegion\tRevenue\nNorth\t10\nSouth\t20";
    expect(table(grid, 0).columns.map((c) => c.label)).toEqual(["", ""]);
    // With 0 header rows the header text counts as data: 2 text cells vs 2 numbers, and ties go to text.
    expect(table(grid, 0).columns[1].type).toBe("string");
    expect(table(grid, 2).columns.map((c) => c.label)).toEqual(["Q1 Region", "Q1 Revenue"]);
    expect(table(grid, 2, "C").columns.map((c) => c.id)).toEqual(["C", "D"]);
    expect(table(grid, 2, "A", true).columns.map((c) => c.id)).toEqual(["Col1", "Col2"]);
    expect(firstColumnOf("'Q1 data'!$C$2:H")).toBe("C");
    expect(rows("select sum(B)", table("North\t10\nSouth\t20", 0))).toEqual({ headers: ["sum B"], rows: [["30"]] });
  });

  it("treats minority types as empty, as Google does", () => {
    const t = table("Code\n100\n200\nn/a\n300");
    expect(t.columns[0]).toMatchObject({ type: "number", mismatched: 1 });
    expect(rows("select count(A)", t).rows).toEqual([["3"]]);
  });
});

describe("evaluator", () => {
  it("filters text, numbers and dates, including date literals", () => {
    expect(rows("select C, F where B = 'North' and F > 1500").rows).toEqual([["Ava Chen", "3897"], ["Maya Patel", "1743"], ["Ava Chen", "2598"]]);
    expect(rows("select A, D where A >= date '2026-04-14' order by A").rows.map((r) => r[0])).toEqual(["2026-04-14", "2026-04-20", "2026-04-24", "2026-04-29"]);
    expect(rows("select count(A) where C starts with 'S' or C contains 'Lee'").rows).toEqual([["9"]]);
    expect(rows("select count(A) where C like '%a%n'").rows).toEqual([["8"]]);
    expect(rows("select count(A) where D matches 'Lap.*'").rows).toEqual([["9"]]);
  });

  it("groups, aggregates, labels and sorts", () => {
    const r = rows("select B, sum(F), count(A) group by B order by sum(F) desc label sum(F) 'Revenue', count(A) 'Orders'");
    expect(r.headers).toEqual(["Region", "Revenue", "Orders"]);
    expect(r.rows).toEqual([["West", "14424", "6"], ["North", "11271", "6"], ["East", "9281", "6"], ["South", "7581", "6"]]);
    expect(rows("select B, avg(E) group by B").rows[0]).toEqual(["East", "3.16666666666667"]);
    expect(rows("select B, max(A) group by B").headers).toEqual(["Region", "max Date"]);
  });

  it("pivots with one and with two aggregates", () => {
    const one = rows("select B, sum(F) group by B pivot D");
    expect(one.headers).toEqual(["Region", "Dock", "Laptop", "Monitor"]);
    expect(one.rows.find((r) => r[0] === "North")).toEqual(["North", "1788", "6495", "2988"]);
    const two = rows("select sum(F), count(A) pivot D");
    expect(two.headers).toEqual(["Dock sum Revenue", "Dock count Date", "Laptop sum Revenue", "Laptop count Date", "Monitor sum Revenue", "Monitor count Date"]);
  });

  it("applies limit, offset and scalar functions", () => {
    expect(rows("select C order by F desc limit 2 offset 1").rows).toEqual([["Sofia Rossi"], ["Ava Chen"]]);
    expect(rows("select month(A), sum(F) group by month(A)").rows[0]).toEqual(["0", "11227"]);
    expect(rows("select upper(B) where E = 9").rows).toEqual([["WEST"]]);
  });

  it("explains invalid queries in plain words", () => {
    const err = (q: string) => () => runQuery(table(), q);
    expect(err("select B, sum(F)")).toThrow(/must either be inside an aggregate .* or listed in group by/);
    expect(err("select sum(B)")).toThrow(/sum\(\) only works on numbers/);
    expect(err("select A where F > '100'")).toThrow(/Remove the quotes around the number/);
    expect(err("select A where B = North")).toThrow(/“North” is not a column/);
    expect(err("where B = 'x' select A")).toThrow(/wrong place/);
    expect(err("select A where A > date '2026-02-30'")).toThrow(/not valid/);
    expect(err("select A where C = 'O'Brien'")).toThrow(QueryError);
    expect(() => parseQuery("select foo(A)", ["A"])).toThrow(/not supported/);
  });
});

describe("builder", () => {
  it("quotes values with apostrophes using double quotes, and refuses values with both quotes", () => {
    expect(queryString("Paris")).toBe("'Paris'");
    expect(queryString("O'Brien")).toBe('"O\'Brien"');
    expect(() => queryString(`O'Brien "Jr"`)).toThrow(BuildError);
    const t = table();
    const q = buildQuery({ ...base, select: [{ col: "C", agg: "", label: "" }, { col: "F", agg: "", label: "" }], filters: [{ col: "C", op: "=", value: "Liam O'Brien", cell: "", join: "and" }] }, t.columns);
    expect(q).toBe(`select C, F where C = "Liam O'Brien"`);
    expect(toFormula(q, EXAMPLE_RANGE, 1)).toBe(`=QUERY(Sales!A1:F, "select C, F where C = ""Liam O'Brien""", 1)`);
    expect(rows(q).rows).toHaveLength(4);
  });

  it("writes typed literals: numbers bare, dates as date 'yyyy-mm-dd'", () => {
    expect(literalFor("number", "1,500", ">")).toBe("1500");
    expect(literalFor("date", "1/31/2026", ">=")).toBe("date '2026-01-31'");
    expect(literalFor("boolean", "TRUE", "=")).toBe("true");
    expect(() => literalFor("number", "ten", ">")).toThrow(/not a number/);
    expect(() => literalFor("date", "31/01/2026", ">")).toThrow(/yyyy-mm-dd/);
  });

  it("builds group by + aggregation + label + pivot, and checks Google's rules", () => {
    const t = table();
    const state: BuilderState = { ...base, select: [{ col: "B", agg: "", label: "" }, { col: "F", agg: "sum", label: "Total" }], groupBy: ["B"], pivot: "D", orderBy: [{ target: "B", desc: false }] };
    const q = buildQuery(state, t.columns);
    expect(q).toBe("select B, sum(F) group by B pivot D order by B label sum(F) 'Total'");
    expect(rows(q).headers).toEqual(["Region", "Dock", "Laptop", "Monitor"]);
    expect(() => buildQuery({ ...state, groupBy: [] }, t.columns)).toThrow(/must be in group by/);
    expect(() => buildQuery({ ...state, select: [{ col: "B", agg: "", label: "" }, { col: "C", agg: "sum", label: "" }] }, t.columns)).toThrow(/sum needs a number column/);
    expect(() => buildQuery({ ...state, orderBy: [{ target: "sum(F)", desc: true }] }, t.columns)).toThrow(/With pivot/);
  });

  it("filters by a cell reference in the formula and uses the sample value in the preview", () => {
    const t = table();
    const state: BuilderState = { ...base, select: [{ col: "C", agg: "", label: "" }], filters: [{ col: "B", op: "=", value: "West", cell: "H1", join: "and" }, { col: "A", op: ">=", value: "2026-03-01", cell: "H2", join: "and" }] };
    const formula = toFormula(buildQuery(state, t.columns), EXAMPLE_RANGE, 1);
    expect(formula).toBe(`=QUERY(Sales!A1:F, "select C where B = '"&H1&"' and A >= date '"&TEXT(H2,"yyyy-mm-dd")&"'", 1)`);
    expect(rows(buildPreviewQuery(state, t.columns)).rows).toEqual([["Sofia Rossi"], ["Sofia Rossi"], ["Sofia Rossi"]]);
    expect(() => buildPreviewQuery({ ...state, filters: [{ ...state.filters[0], value: "" }] }, t.columns)).toThrow(/sample value for H1/);
  });
});
