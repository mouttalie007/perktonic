// Shared by the browser component and the server. No imports on purpose (B2).

export const SLUG = "excel-formula-to-sql-converter";
/** Same numbers as AI_LIMIT in @/lib/tools/llm; a test keeps them in sync. */
export const AI_REQUESTS = 10;
export const AI_WINDOW_MINUTES = 10;
export const MAX_SOURCE_CHARS = 4000;
export const MAX_SCHEMA_CHARS = 2000;
export const LIMIT_TEXT = `${AI_REQUESTS} AI requests per ${AI_WINDOW_MINUTES} minutes`;

export const TARGETS = [
  { id: "postgresql", label: "PostgreSQL", parser: "postgresql" },
  { id: "mysql", label: "MySQL", parser: "mysql" },
  { id: "sqlite", label: "SQLite", parser: "sqlite" },
  { id: "sqlserver", label: "SQL Server (T-SQL)", parser: "transactsql" },
  { id: "pandas", label: "Python pandas", parser: null },
] as const;
export type Target = (typeof TARGETS)[number]["id"];
