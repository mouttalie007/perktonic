// Server-side SQL syntax check with node-sql-parser (Apache-2.0) in the matching dialect.
// The code is parsed only; it is never run and no database is contacted.
import { Parser } from "node-sql-parser";
import { TARGETS, type Target } from "../limits";

export type SqlCheck = { status: "ok" } | { status: "failed"; message: string; line: number | null } | { status: "skipped"; reason: string };

/** Constructs node-sql-parser does not parse in v5 for these dialects: reported as "not checked", not as errors. */
const UNSUPPORTED: { re: RegExp; what: string }[] = [
  { re: /\b(UN)?PIVOT\s*\(/i, what: "PIVOT / UNPIVOT" },
  { re: /\bMERGE\s+INTO\b/i, what: "MERGE" },
  { re: /\bQUALIFY\b/i, what: "QUALIFY" },
  { re: /\bMATCH_RECOGNIZE\b/i, what: "MATCH_RECOGNIZE" },
  { re: /\bLIKE\s+'[^']*'\s+ESCAPE\b/i, what: "LIKE … ESCAPE" },
];

let parser: Parser | null = null;

export function checkSql(sql: string, target: Exclude<Target, "pandas">): SqlCheck {
  const dialect = TARGETS.find((t) => t.id === target)!.parser!;
  const hit = UNSUPPORTED.find((u) => u.re.test(sql));
  if (hit) return { status: "skipped", reason: `${hit.what} is not supported by our SQL checker, so this query was not checked.` };
  parser ??= new Parser();
  try {
    parser.astify(sql, { database: dialect });
    return { status: "ok" };
  } catch (e) {
    const err = e as { name?: string; message?: string; location?: { start?: { line?: number } } };
    if (err.name !== "SyntaxError") return { status: "skipped", reason: "Our SQL checker could not process this query, so it was not checked." };
    return { status: "failed", message: String(err.message ?? "Syntax error").slice(0, 300), line: err.location?.start?.line ?? null };
  }
}
