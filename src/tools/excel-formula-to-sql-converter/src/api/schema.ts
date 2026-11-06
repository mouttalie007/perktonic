import { z } from "zod";
import { MAX_SCHEMA_CHARS, MAX_SOURCE_CHARS } from "../limits";

export const RequestSchema = z.object({
  source: z
    .string({ error: "Paste a formula or describe the spreadsheet logic." })
    .trim()
    .min(3, "Paste a formula or describe the spreadsheet logic.")
    .max(MAX_SOURCE_CHARS, `The formula or description is longer than ${MAX_SOURCE_CHARS.toLocaleString("en-US")} characters. Shorten it.`),
  schema: z
    .string()
    .max(MAX_SCHEMA_CHARS, `The table description is longer than ${MAX_SCHEMA_CHARS.toLocaleString("en-US")} characters. Shorten it.`)
    .optional()
    .default(""),
  target: z.enum(["postgresql", "mysql", "sqlite", "sqlserver", "pandas"], { error: "Pick PostgreSQL, MySQL, SQLite, SQL Server or pandas." }),
});
export type { ApiResponse } from "../types";
