import { describe, expect, it } from "vitest";
import { inferType } from "../src/logic/infer";
import { columnNames, quoteIdent, safeName } from "../src/logic/names";
import { createTable, generate, literal, sqlType, stringLiteral, type Plan } from "../src/logic/sql";
import { analyzeColumns, readTable } from "../src/logic/table";
import type { Dialect, Options } from "../src/logic/types";
import { SAMPLE_CSV } from "../fixtures/examples";

const OPTS: Options = { dialect: "postgresql", table: "customers", createTable: true, dropTable: false, inserts: true, batchSize: 100, transaction: false, emptyText: "null", nullTokens: false, notNull: false, primaryKey: null, quoteAll: false };

function planFor(csv: string, dialect: Dialect, extra: Partial<Options> = {}): { plan: Plan; rows: string[][] } {
  const t = readTable(csv, true);
  const cols = analyzeColumns(t, dialect);
  return { plan: { options: { ...OPTS, dialect, ...extra }, columns: cols.map((c) => ({ name: c.name, type: c.detected, info: c })) }, rows: t.rows };
}

describe("type detection", () => {
  it("detects integer, bigint, decimal, boolean, date, timestamp and text, with the reason", () => {
    expect(inferType(["1", "-42", "", "7"])).toMatchObject({ type: "integer", reason: "all 3 filled values are whole numbers" });
    expect(inferType(["1", "3000000000"]).type).toBe("bigint");
    expect(inferType(["99999999999999999999"])).toMatchObject({ type: "decimal", precision: 20, scale: 0 });
    expect(inferType(["1250.50", "89.99", "0", "15.5"])).toMatchObject({ type: "decimal", precision: 6, scale: 2 });
    expect(inferType(["true", "FALSE", "yes", "No"]).type).toBe("boolean");
    expect(inferType(["2024-03-14", "2024-02-29"]).type).toBe("date");
    expect(inferType(["2026-02-29"]).type).toBe("text");
    expect(inferType(["2026-10-28 09:15:00", "2026-10-30T17:42:11Z", "2026-01-01"])).toMatchObject({ type: "timestamp", hasZone: true });
    expect(inferType(["02134", "10001"])).toMatchObject({ type: "text", reason: expect.stringMatching(/leading zeros/) });
    expect(inferType(["12", "15", "18", "20", "22", "n/a"]).reason).toBe("mostly numbers, but “n/a” is not");
    expect(inferType(["", ""]).type).toBe("text");
  });

  it("reads the sample: header, quotes, embedded newline, and the first 10,000-row sample size", () => {
    const t = readTable(SAMPLE_CSV, true);
    expect(t.rows).toHaveLength(5);
    expect(t.rows[3][9]).toBe("Two lines:\nsecond line");
    const cols = analyzeColumns(t, "postgresql");
    expect(cols.map((c) => [c.name, c.detected])).toEqual([
      ["customer_id", "integer"], ["full_name", "text"], ["email", "text"], ["signup_date", "date"], ["last_login", "timestamp"],
      ["lifetime_value", "decimal"], ["is_active", "boolean"], ["zip", "text"], ["group", "text"], ["notes", "text"],
    ]);
    expect(cols[4].empty).toBe(1);
    expect(cols[0].sampled).toBe(5);
    const big = "n\n" + Array.from({ length: 12_000 }, (_, i) => (i < 11_000 ? String(i) : "x")).join("\n");
    const bigCols = analyzeColumns(readTable(big, true), "mysql");
    expect(bigCols[0]).toMatchObject({ detected: "integer", sampled: 10_000 });
  });
});

describe("names", () => {
  it("cleans names safely and quotes reserved words per dialect", () => {
    expect(safeName("Lifetime Value (€)", "x", "mysql")).toBe("lifetime_value");
    expect(safeName("Café Größe", "x", "mysql")).toBe("cafe_grosse");
    expect(safeName("2026 Revenue", "x", "mysql")).toBe("c_2026_revenue");
    expect(safeName("OrderID", "x", "mysql")).toBe("order_id");
    expect(safeName("x".repeat(100), "x", "postgresql")).toHaveLength(63);
    expect(columnNames(["Email", "email", "", "E-mail"], "sqlite")).toEqual(["email", "email_2", "column_3", "e_mail"]);
    expect(quoteIdent("group", "mysql", false)).toBe("`group`");
    expect(quoteIdent("group", "sqlserver", false)).toBe("[group]");
    expect(quoteIdent("order", "postgresql", false)).toBe("\"order\"");
    expect(quoteIdent("email", "postgresql", false)).toBe("email");
    expect(quoteIdent("a]b", "sqlserver", true)).toBe("[a]]b]");
  });
});

describe("values", () => {
  it("escapes quotes everywhere and backslashes only for MySQL; N'' for Unicode in SQL Server", () => {
    expect(stringLiteral("O'Brien", "postgresql")).toBe("'O''Brien'");
    expect(stringLiteral("C:\\temp", "mysql")).toBe("'C:\\\\temp'");
    expect(stringLiteral("C:\\temp", "postgresql")).toBe("'C:\\temp'");
    expect(stringLiteral("Seán", "sqlserver")).toBe("N'Seán'");
    expect(stringLiteral("Sean", "sqlserver")).toBe("'Sean'");
  });

  it("keeps NULL and empty strings apart, and maps booleans per dialect", () => {
    const o = { emptyText: "null" as const, nullTokens: false };
    expect(literal("", "text", "postgresql", o).sql).toBe("NULL");
    expect(literal("", "text", "postgresql", { ...o, emptyText: "empty" }).sql).toBe("''");
    expect(literal("", "integer", "postgresql", { ...o, emptyText: "empty" }).sql).toBe("NULL");
    expect(literal("NULL", "text", "mysql", o).sql).toBe("'NULL'");
    expect(literal("\\N", "text", "mysql", { ...o, nullTokens: true }).sql).toBe("NULL");
    expect(["postgresql", "mysql", "sqlite", "sqlserver"].map((d) => literal("yes", "boolean", d as Dialect, o).sql)).toEqual(["TRUE", "1", "1", "1"]);
    expect(literal("+42", "integer", "sqlite", o).sql).toBe("42");
    expect(literal("2026-10-30T17:42:11Z", "timestamp", "mysql", o).sql).toBe("'2026-10-30 17:42:11+00:00'");
  });
});

describe("statements", () => {
  it("writes CREATE TABLE with dialect types, primary key and NOT NULL", () => {
    const { plan } = planFor(SAMPLE_CSV, "sqlserver", { primaryKey: 0, notNull: true, dropTable: true });
    expect(createTable(plan)).toBe(
      "DROP TABLE IF EXISTS customers;\nCREATE TABLE customers (\n  customer_id INT NOT NULL,\n  full_name NVARCHAR(32) NOT NULL,\n  email NVARCHAR(32) NOT NULL,\n  signup_date DATE NOT NULL,\n  last_login DATETIMEOFFSET,\n  lifetime_value DECIMAL(6,2) NOT NULL,\n  is_active BIT NOT NULL,\n  zip NVARCHAR(16) NOT NULL,\n  [group] NVARCHAR(16),\n  notes NVARCHAR(32),\n  PRIMARY KEY (customer_id)\n);",
    );
    const types = (d: Dialect) => planFor(SAMPLE_CSV, d).plan.columns.map((c) => sqlType(c.info, c.type, d));
    expect(types("mysql").slice(3, 7)).toEqual(["DATE", "DATETIME", "DECIMAL(6,2)", "BOOLEAN"]);
    expect(types("postgresql").slice(3, 7)).toEqual(["DATE", "TIMESTAMPTZ", "NUMERIC(6,2)", "BOOLEAN"]);
    expect(types("sqlite").slice(3, 7)).toEqual(["TEXT", "TEXT", "NUMERIC", "INTEGER"]);
  });

  it("batches INSERTs, wraps them in a transaction, and reports values that do not fit the chosen type", () => {
    const csv = "id,amount\n" + Array.from({ length: 7 }, (_, i) => `${i + 1},${i === 5 ? "n/a" : i * 10}`).join("\n");
    const t = readTable(csv, true);
    const cols = analyzeColumns(t, "postgresql");
    const plan: Plan = { options: { ...OPTS, batchSize: 3, transaction: true, createTable: false }, columns: cols.map((c, i) => ({ name: c.name, type: i === 1 ? "integer" : c.detected, info: c })) };
    const { sql, problems } = generate(plan, t.rows);
    expect(sql.split("\n")[0]).toBe("BEGIN;");
    expect((sql.match(/INSERT INTO customers \(id, amount\) VALUES/g) ?? []).length).toBe(3);
    expect(sql).toContain("  (6, 'n/a');");
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
    expect(problems).toEqual([{ column: "amount", type: "integer", count: 1, examples: [{ row: 6, value: "n/a" }] }]);
    // SQL Server allows at most 1,000 rows per VALUES list, whatever the batch size asked.
    const many = readTable("v\n" + Array.from({ length: 2500 }, (_, i) => String(i)).join("\n"), true);
    const mc = analyzeColumns(many, "sqlserver");
    const ms = generate({ options: { ...OPTS, dialect: "sqlserver", batchSize: 5000, createTable: false }, columns: mc.map((c) => ({ name: c.name, type: c.detected, info: c })) }, many.rows).sql;
    expect((ms.match(/INSERT INTO/g) ?? []).length).toBe(3);
  });

  it("produces the expected MySQL script for the sample", () => {
    const { plan, rows } = planFor(SAMPLE_CSV, "mysql", { createTable: false });
    const sql = generate(plan, rows).sql;
    expect(sql).toContain("INSERT INTO customers (customer_id, full_name, email, signup_date, last_login, lifetime_value, is_active, zip, `group`, notes) VALUES");
    expect(sql).toContain("(1003, 'O''Brien, Seán', 'sean@example.ie', '2025-01-20', NULL, 0, 0, 'D02 X285', NULL, 'Said: \"call me back\"')");
    expect(sql).toContain("'C:\\\\temp\\\\export'");
    expect(sql).toContain("'Two lines:\nsecond line'");
  });
});
