// No imports: shared by the page and the worker.

export type Dialect = "mysql" | "postgresql" | "sqlite" | "sqlserver";
export const DIALECTS: { id: Dialect; label: string }[] = [
  { id: "mysql", label: "MySQL / MariaDB" },
  { id: "postgresql", label: "PostgreSQL" },
  { id: "sqlite", label: "SQLite" },
  { id: "sqlserver", label: "SQL Server" },
];

export type ColumnType = "integer" | "bigint" | "decimal" | "boolean" | "date" | "timestamp" | "text";
export const COLUMN_TYPES: ColumnType[] = ["integer", "bigint", "decimal", "boolean", "date", "timestamp", "text"];

export interface ColumnInfo {
  /** Header as written in the file. */
  source: string;
  /** Column name used in SQL (already cleaned). */
  name: string;
  detected: ColumnType;
  /** Why this type: e.g. "all 9,812 filled values are whole numbers". */
  reason: string;
  /** For decimal: total digits and digits after the point. */
  precision: number;
  scale: number;
  maxLength: number;
  /** Timestamps with a time zone offset or Z. */
  hasZone: boolean;
  empty: number;
  sampled: number;
  examples: string[];
}

export interface Options {
  dialect: Dialect;
  table: string;
  createTable: boolean;
  dropTable: boolean;
  inserts: boolean;
  batchSize: number;
  transaction: boolean;
  /** Empty cells in text columns: NULL or ''. Other types always get NULL. */
  emptyText: "null" | "empty";
  /** Also read NULL and \N as NULL. */
  nullTokens: boolean;
  notNull: boolean;
  primaryKey: number | null;
  quoteAll: boolean;
}
