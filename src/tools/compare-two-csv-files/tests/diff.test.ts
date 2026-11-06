import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/logic/csvParser";
import { diffTables, joinTables, mapColumns, stackUnique, suggestKeys, type Table } from "../src/logic/diff";
import { groupCsv } from "../src/logic/report";
import { SAMPLE_A, SAMPLE_B } from "../fixtures/examples";

const table = (csv: string): Table => {
  const rows = parseCsv(csv.trim(), ",").rows;
  return { headers: rows[0], rows: rows.slice(1) };
};
const A = table(SAMPLE_A);
const B = table(SAMPLE_B);
const strict = { ignoreCase: false, trim: false, trimValues: false };
const loose = { ignoreCase: true, trim: true, trimValues: false };

describe("columns", () => {
  it("matches columns by name whatever their order, and lists columns missing on one side", () => {
    const m = mapColumns(A.headers, B.headers);
    expect(m.common.map(([a, b, n]) => `${n}:${a}->${b}`)).toEqual(["sku:0->0", "name:1->2", "price:2->1", "stock:3->3"]);
    expect(m.onlyA).toEqual([]);
    expect(m.onlyB).toEqual(["category"]);
    expect(suggestKeys(A, B)).toEqual(["sku"]);
  });
});

describe("diff", () => {
  it("finds added, removed and changed rows by key, with the changed cells", () => {
    const d = diffTables(A, B, { keys: ["sku"], ...loose });
    expect(d.added.map((j) => B.rows[j][0])).toEqual(["KET-11"]);
    expect(d.removed.map((i) => A.rows[i][0])).toEqual(["CUP-09"]);
    expect(d.changed.map((c) => [A.rows[c.a][0], c.cols.map((i) => d.columns.common[i][2])])).toEqual([
      ["MUG-01", ["stock"]],
      ["MUG-02", ["price"]],
      ["TEA-07", ["stock"]],
    ]);
    expect(d.unchanged).toBe(1);
  });

  it("treats key case and spaces as different unless the option is on", () => {
    const d = diffTables(A, B, { keys: ["sku"], ...strict });
    expect(d.added.map((j) => B.rows[j][0])).toEqual(["tea-07 ", "KET-11"]);
    expect(d.removed.map((i) => A.rows[i][0])).toEqual(["TEA-07", "CUP-09"]);
  });

  it("supports composite keys and reports duplicate keys, pairing them in order", () => {
    const a = table("store,sku,qty\nParis,A,1\nParis,B,2\nLyon,A,3\nLyon,A,4\n");
    const b = table("store,sku,qty\nLyon,A,3\nParis,A,1\nParis,B,5\nLyon,A,9\nLyon,A,4\n");
    const d = diffTables(a, b, { keys: ["store", "sku"], ...strict });
    expect(d.duplicatesA).toEqual([{ key: "Lyon | A", count: 2 }]);
    expect(d.duplicatesB).toEqual([{ key: "Lyon | A", count: 3 }]);
    // The first "Lyon | A" in B pairs with the first in A (unchanged), the second with the second (4 → 9), the third is new.
    expect(d.changed.map((c) => [c.a, c.b])).toEqual([[1, 2], [3, 3]]);
    expect(d.added).toEqual([4]);
    expect(d.unchanged).toBe(2);
  });

  it("compares row by row when there is no key, and handles missing columns", () => {
    const a = table("x,y,z\n1,2,3\n4,5,6\n7,8,9\n");
    const b = table("y,x\n2,1\n5,40\n");
    const d = diffTables(a, b, { keys: [], ...strict });
    expect(d.columns.onlyA).toEqual(["z"]);
    expect(d.changed).toEqual([{ a: 1, b: 1, cols: [0] }]);
    expect(d.removed).toEqual([2]);
    expect(d.unchanged).toBe(1);
  });

  it("handles 500,000 rows per file", () => {
    const n = 500_000;
    const a: Table = { headers: ["id", "name", "amount"], rows: Array.from({ length: n }, (_, i) => [`C${i}`, `Customer ${i}`, String(i % 1000)]) };
    const b: Table = { headers: ["id", "amount", "name"], rows: Array.from({ length: n }, (_, i) => [`C${i + 10}`, String(i % 997 === 0 ? 1 : (i + 10) % 1000), `Customer ${i + 10}`]) };
    const d = diffTables(a, b, { keys: ["id"], ...strict });
    expect(d.added).toHaveLength(10);
    expect(d.removed).toHaveLength(10);
    expect(d.changed.length + d.unchanged).toBe(n - 10);
    expect(d.changed.length).toBeGreaterThan(400);
  }, 60_000);
});

describe("merge", () => {
  it("joins inner, left, right and outer, suffixing shared columns", () => {
    const a = table("id,name,city\n1,Ann,Paris\n2,Bob,Lyon\n3,Cid,Nice\n");
    const b = table("id,city,plan\n2,Lille,pro\n3,Nice,free\n4,Metz,pro\n");
    const ids = (type: "inner" | "left" | "right" | "outer") => joinTables(a, b, ["id"], type, strict).rows.map((r) => r[0]);
    expect(joinTables(a, b, ["id"], "inner", strict).headers).toEqual(["id", "name", "city (A)", "city (B)", "plan"]);
    expect(joinTables(a, b, ["id"], "inner", strict).rows[0]).toEqual(["2", "Bob", "Lyon", "Lille", "pro"]);
    expect(ids("inner")).toEqual(["2", "3"]);
    expect(ids("left")).toEqual(["1", "2", "3"]);
    expect(ids("right")).toEqual(["2", "3", "4"]);
    expect(ids("outer")).toEqual(["1", "2", "3", "4"]);
    expect(joinTables(a, b, ["id"], "outer", strict).rows[3]).toEqual(["4", "", "", "Metz", "pro"]);
    const dup = joinTables(table("k,v\n1,a\n"), table("k,w\n1,x\n1,y\n"), ["k"], "inner", strict);
    expect(dup.rows).toHaveLength(2);
    expect(dup.multiplied).toBe(1);
  });

  it("stacks both files and removes cross-file duplicates by key", () => {
    const r = stackUnique(A, B, ["sku"], { ignoreCase: true, trim: true });
    expect(r.headers).toEqual(["sku", "name", "price", "stock", "category"]);
    expect(r.rows.map((x) => x[0])).toEqual(["MUG-01", "MUG-02", "TEA-07", "SET-03", "CUP-09", "KET-11"]);
    expect(r.removedDuplicates).toBe(4);
    expect(r.rows[5]).toEqual(["KET-11", "Glass kettle", "39.00", "20", "kitchen"]);
  });
});

describe("downloads", () => {
  it("writes each group as CSV", () => {
    const d = diffTables(A, B, { keys: ["sku"], ...loose });
    expect(groupCsv("changed", A, B, d, ["sku"])).toBe("sku,column,old value,new value\r\nMUG-01,stock,140,128\r\nMUG-02,price,18.00,19.50\r\ntea-07 ,stock,80,72\r\n");
    expect(groupCsv("added", A, B, d, ["sku"])).toBe("sku,price,name,stock,category\r\nKET-11,39.00,Glass kettle,20,kitchen\r\n");
    expect(groupCsv("removed", A, B, d, ["sku"]).split("\r\n")[1]).toBe("CUP-09,Espresso cup,4.00,0");
    const report = groupCsv("report", A, B, d, ["sku"]).split("\r\n");
    expect(report[0]).toBe("_status,_changed_columns,sku,price,name,stock,category");
    expect(report[2]).toBe("changed,price,MUG-02,19.50,Travel mug,35,mugs");
    expect(report[6]).toBe("removed,,CUP-09,4.00,Espresso cup,0,");
  });
});
