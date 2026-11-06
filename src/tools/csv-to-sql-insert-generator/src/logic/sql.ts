import { boolValue, fits, timestampParts } from "./infer";
import { quoteIdent } from "./names";
import type { ColumnInfo, ColumnType, Dialect, Options } from "./types";

/** The SQL type for a column in one dialect. */
export function sqlType(col: Pick<ColumnInfo, "precision" | "scale" | "maxLength" | "hasZone">, type: ColumnType, dialect: Dialect): string {
  switch (type) {
    case "integer":
      return dialect === "mysql" ? "INT" : dialect === "sqlserver" ? "INT" : "INTEGER";
    case "bigint":
      return dialect === "sqlite" ? "INTEGER" : "BIGINT";
    case "decimal": {
      const p = Math.max(1, Math.min(38, col.precision || 18));
      const s = Math.min(col.scale, p);
      if (dialect === "sqlite") return "NUMERIC";
      return `${dialect === "postgresql" ? "NUMERIC" : "DECIMAL"}(${p},${s})`;
    }
    case "boolean":
      return dialect === "mysql" ? "BOOLEAN" : dialect === "sqlserver" ? "BIT" : dialect === "sqlite" ? "INTEGER" : "BOOLEAN";
    case "date":
      return dialect === "sqlite" ? "TEXT" : "DATE";
    case "timestamp":
      if (dialect === "sqlite") return "TEXT";
      if (dialect === "postgresql") return col.hasZone ? "TIMESTAMPTZ" : "TIMESTAMP";
      if (dialect === "sqlserver") return col.hasZone ? "DATETIMEOFFSET" : "DATETIME2";
      return "DATETIME";
    case "text": {
      const len = col.maxLength;
      if (dialect === "sqlite") return "TEXT";
      // Room to grow: the next round size above the longest value seen.
      const size = [16, 32, 64, 128, 255, 1000, 4000].find((x) => x >= len);
      if (dialect === "sqlserver") return size ? `NVARCHAR(${size})` : "NVARCHAR(MAX)";
      if (dialect === "postgresql") return size && size <= 255 ? `VARCHAR(${size})` : "TEXT";
      return size && size <= 1000 ? `VARCHAR(${size})` : "TEXT";
    }
  }
}

/** A string literal: quotes doubled everywhere; MySQL also treats backslash as an escape by default. */
export function stringLiteral(v: string, dialect: Dialect): string {
  let s = v.replace(/'/g, "''");
  if (dialect === "mysql") s = s.replace(/\\/g, "\\\\").replace(/\0/g, "\\0");
  else s = s.replace(/\0/g, "");
  // N'…' keeps non-Latin text intact in SQL Server's NVARCHAR columns.
  return dialect === "sqlserver" && /[^\x00-\x7f]/.test(s) ? `N'${s}'` : `'${s}'`;
}

export interface Problem {
  column: string;
  type: ColumnType;
  count: number;
  /** First few offenders: 1-based data row and value. */
  examples: { row: number; value: string }[];
}

export function literal(raw: string, type: ColumnType, dialect: Dialect, opts: Pick<Options, "emptyText" | "nullTokens">): { sql: string; ok: boolean } {
  if (raw === "" && !(type === "text" && opts.emptyText === "empty")) return { sql: "NULL", ok: true };
  if (opts.nullTokens && (raw === "NULL" || raw === "\\N")) return { sql: "NULL", ok: true };
  if (type !== "text" && !fits(raw, type)) return { sql: stringLiteral(raw, dialect), ok: false };
  switch (type) {
    case "integer":
    case "bigint":
    case "decimal":
      return { sql: raw.replace(/^\+/, ""), ok: true };
    case "boolean": {
      const b = boolValue(raw);
      return { sql: dialect === "postgresql" ? (b ? "TRUE" : "FALSE") : b ? "1" : "0", ok: true };
    }
    case "timestamp": {
      // A space instead of T is accepted by all four, and MySQL DATETIME and SQLite text sort better that way.
      let v = raw.replace("T", " ");
      if (dialect === "mysql" && timestampParts(raw)?.zone) v = raw.replace("T", " ").replace(/Z$/, "+00:00");
      return { sql: stringLiteral(v, dialect), ok: true };
    }
    default:
      return { sql: stringLiteral(raw, dialect), ok: true };
  }
}

export interface Plan {
  columns: { name: string; type: ColumnType; info: Pick<ColumnInfo, "precision" | "scale" | "maxLength" | "hasZone" | "empty"> }[];
  options: Options;
}

export function createTable(plan: Plan): string {
  const { options: o } = plan;
  const q = (s: string) => quoteIdent(s, o.dialect, o.quoteAll);
  const table = q(o.table);
  const lines = plan.columns.map((c, i) => {
    const notNull = (o.notNull && c.info.empty === 0) || o.primaryKey === i;
    return `  ${q(c.name)} ${sqlType(c.info, c.type, o.dialect)}${notNull ? " NOT NULL" : ""}`;
  });
  if (o.primaryKey !== null && plan.columns[o.primaryKey]) lines.push(`  PRIMARY KEY (${q(plan.columns[o.primaryKey].name)})`);
  const out: string[] = [];
  if (o.dropTable) out.push(`DROP TABLE IF EXISTS ${table};`);
  out.push(`CREATE TABLE ${table} (\n${lines.join(",\n")}\n);`);
  return out.join("\n");
}

const BEGIN: Record<Dialect, string> = { mysql: "START TRANSACTION;", postgresql: "BEGIN;", sqlite: "BEGIN TRANSACTION;", sqlserver: "BEGIN TRANSACTION;" };

/**
 * Writes the whole script. `onProgress` is called every few thousand rows so
 * the worker can report progress; rows are written in batches of `batchSize`
 * (SQL Server accepts at most 1,000 rows per VALUES list).
 */
export function generate(plan: Plan, rows: string[][], onProgress?: (done: number) => void): { sql: string; problems: Problem[] } {
  const o = plan.options;
  const q = (s: string) => quoteIdent(s, o.dialect, o.quoteAll);
  const parts: string[] = [];
  const problems: Problem[] = plan.columns.map((c) => ({ column: c.name, type: c.type, count: 0, examples: [] }));
  if (o.createTable) parts.push(createTable(plan), "");
  if (o.inserts && rows.length > 0) {
    if (o.transaction) parts.push(BEGIN[o.dialect]);
    const head = `INSERT INTO ${q(o.table)} (${plan.columns.map((c) => q(c.name)).join(", ")}) VALUES`;
    const size = Math.max(1, Math.min(o.dialect === "sqlserver" ? 1000 : 100_000, Math.floor(o.batchSize) || 1));
    let batch: string[] = [];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const vals = plan.columns.map((c, i) => {
        const lit = literal(row[i] ?? "", c.type, o.dialect, o);
        if (!lit.ok) {
          const p = problems[i];
          p.count++;
          if (p.examples.length < 3) p.examples.push({ row: r + 1, value: (row[i] ?? "").slice(0, 60) });
        }
        return lit.sql;
      });
      batch.push(`  (${vals.join(", ")})`);
      if (batch.length >= size) {
        parts.push(`${head}\n${batch.join(",\n")};`);
        batch = [];
      }
      if (onProgress && r % 5000 === 4999) onProgress(r + 1);
    }
    if (batch.length) parts.push(`${head}\n${batch.join(",\n")};`);
    if (o.transaction) parts.push("COMMIT;");
  }
  return { sql: parts.join("\n") + "\n", problems: problems.filter((p) => p.count > 0) };
}
