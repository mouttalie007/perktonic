import type { Column } from "./data";
import type { AggFn } from "./query";
import { parseDate, parseNumber, type ColType } from "./values";

export type Operator = "=" | "!=" | ">" | ">=" | "<" | "<=" | "contains" | "starts with" | "ends with" | "matches" | "like" | "is null" | "is not null";

export const OPERATORS: { op: Operator; label: string; types: ColType[] | "all" }[] = [
  { op: "=", label: "is", types: "all" },
  { op: "!=", label: "is not", types: "all" },
  { op: ">", label: "greater than", types: ["number", "date", "datetime"] },
  { op: ">=", label: "at least", types: ["number", "date", "datetime"] },
  { op: "<", label: "less than", types: ["number", "date", "datetime"] },
  { op: "<=", label: "at most", types: ["number", "date", "datetime"] },
  { op: "contains", label: "contains", types: ["string"] },
  { op: "starts with", label: "starts with", types: ["string"] },
  { op: "ends with", label: "ends with", types: ["string"] },
  { op: "like", label: "like (% and _ wildcards)", types: ["string"] },
  { op: "matches", label: "matches regex", types: ["string"] },
  { op: "is null", label: "is empty", types: "all" },
  { op: "is not null", label: "is not empty", types: "all" },
];

export interface SelectItem {
  col: string;
  agg: AggFn | "";
  label: string;
}

export interface Filter {
  col: string;
  op: Operator;
  value: string;
  /** When set, the value comes from this cell (e.g. H1) instead of being typed in. */
  cell: string;
  join: "and" | "or";
}

export interface BuilderState {
  range: string;
  headerRows: 0 | 1 | 2;
  colNotation: boolean;
  select: SelectItem[];
  filters: Filter[];
  groupBy: string[];
  pivot: string;
  orderBy: { target: string; desc: boolean }[];
  limit: string;
  offset: string;
}

export class BuildError extends Error {}

/**
 * Quotes text for the query language. QUERY has no escape character, so text
 * with an apostrophe goes in double quotes instead; text with both kinds of
 * quote cannot be written as a literal at all.
 */
export function queryString(text: string): string {
  if (!text.includes("'")) return `'${text}'`;
  if (!text.includes("\"")) return `"${text}"`;
  throw new BuildError(`The value ${text} contains both ' and ", which QUERY cannot put in one text value. Put it in a cell and use the “value from cell” option instead.`);
}

export function literalFor(type: ColType, raw: string, op: Operator): string {
  const v = raw.trim();
  if (op === "contains" || op === "starts with" || op === "ends with" || op === "matches" || op === "like") return queryString(raw);
  if (type === "number") {
    const n = parseNumber(v);
    if (n === null) throw new BuildError(`“${raw}” is not a number. This column holds numbers, so type a value like 1200 or 12.5.`);
    return String(n);
  }
  if (type === "date" || type === "datetime") {
    const d = parseDate(v);
    if (!d) throw new BuildError(`“${raw}” is not a date. Use yyyy-mm-dd, for example 2026-01-31.`);
    const iso = new Date(d.date).toISOString();
    return type === "datetime" || d.time ? `datetime '${iso.slice(0, 10)} ${iso.slice(11, 19)}'` : `date '${iso.slice(0, 10)}'`;
  }
  if (type === "boolean") {
    if (!/^(true|false)$/i.test(v)) throw new BuildError(`This column holds TRUE/FALSE values; type true or false instead of “${raw}”.`);
    return v.toLowerCase();
  }
  return queryString(raw);
}

/**
 * A literal that is filled in from a cell when the formula runs. The pieces
 * outside quotes become formula concatenation: "… where B = '"&H1&"' …".
 * The marker is replaced in toFormula().
 */
export const CELL_OPEN = "\u0001";
export const CELL_CLOSE = "\u0002";

function cellLiteral(type: ColType, cell: string, op: Operator): string {
  const ref = cell.trim().toUpperCase();
  if (!/^\$?[A-Z]{1,3}\$?\d+$/.test(ref) && !/^[A-Za-z_][\w.]*!\$?[A-Z]{1,3}\$?\d+$/i.test(cell.trim())) throw new BuildError(`“${cell}” is not a cell reference. Use something like H1 or Settings!B2.`);
  const c = `${CELL_OPEN}${cell.trim()}${CELL_CLOSE}`;
  const text = op === "contains" || op === "starts with" || op === "ends with" || op === "matches" || op === "like";
  if (type === "number" && !text) return c;
  if ((type === "date" || type === "datetime") && !text) return `date '${CELL_OPEN}TEXT(${cell.trim()},"yyyy-mm-dd")${CELL_CLOSE}'`;
  if (type === "boolean" && !text) return c;
  return `'${c}'`;
}

function selectExpr(s: SelectItem): string {
  return s.agg ? `${s.agg}(${s.col})` : s.col;
}

/** Builds the query string from the visual choices, checking the rules Google enforces. */
export function buildQuery(state: BuilderState, columns: Column[]): string {
  return build(state, columns, false);
}

/**
 * The same query with every “value from cell” filter using its typed sample
 * value instead, so the preview can run it without the spreadsheet.
 */
export function buildPreviewQuery(state: BuilderState, columns: Column[]): string {
  return build(state, columns, true);
}

function build(state: BuilderState, columns: Column[], preview: boolean): string {
  const byId = new Map(columns.map((c) => [c.id, c]));
  const need = (id: string, where: string) => {
    const c = byId.get(id);
    if (!c) throw new BuildError(`Choose a column for ${where}.`);
    return c;
  };
  const parts: string[] = [];
  const items = state.select.filter((s) => s.col);
  for (const s of items) {
    const c = need(s.col, "select");
    if ((s.agg === "sum" || s.agg === "avg") && c.type !== "number") throw new BuildError(`${s.agg} needs a number column, but ${c.id}${c.label ? ` (${c.label})` : ""} holds ${c.type === "string" ? "text" : c.type + "s"}. Use count, max or min instead.`);
  }
  const hasAgg = items.some((s) => s.agg);
  const groupBy = state.groupBy.filter(Boolean);
  const pivot = state.pivot;
  if (pivot && !hasAgg) throw new BuildError("Pivot needs at least one aggregated column (sum, count, avg, max or min).");
  if (pivot && groupBy.includes(pivot)) throw new BuildError(`${pivot} cannot be in both group by and pivot.`);
  if (hasAgg || groupBy.length > 0) {
    for (const s of items) {
      if (s.agg) continue;
      if (s.col === pivot) throw new BuildError(`${s.col} is the pivot column, so remove it from the selected columns.`);
      if (!groupBy.includes(s.col)) throw new BuildError(`${s.col} is selected without an aggregate, so it must be in group by (Google returns #VALUE! otherwise). Add it to group by or pick sum/count/… for it.`);
    }
  }
  if (items.length > 0) parts.push(`select ${items.map(selectExpr).join(", ")}`);
  else if (groupBy.length > 0) throw new BuildError("Group by needs columns in select: add the group column and at least one aggregate.");

  const filters = state.filters.filter((f) => f.col);
  if (filters.length > 0) {
    const conds = filters.map((f, i) => {
      const c = need(f.col, "the filter");
      let cond: string;
      if (f.op === "is null" || f.op === "is not null") cond = `${c.id} ${f.op}`;
      else {
        const allowed = OPERATORS.find((o) => o.op === f.op)!.types;
        if (allowed !== "all" && !allowed.includes(c.type)) throw new BuildError(`“${OPERATORS.find((o) => o.op === f.op)!.label}” does not work on ${c.id}, which holds ${c.type === "string" ? "text" : c.type + "s"}.`);
        if (preview && f.cell.trim() && f.value.trim() === "") throw new BuildError(`Type a sample value for ${f.cell.trim()} so the preview can apply that filter.`);
        const value = f.cell.trim() && !preview ? cellLiteral(c.type, f.cell, f.op) : literalFor(c.type, f.value, f.op);
        cond = `${c.id} ${f.op} ${value}`;
      }
      return i === 0 ? cond : `${f.join} ${cond}`;
    });
    parts.push(`where ${conds.join(" ")}`);
  }
  if (groupBy.length > 0) parts.push(`group by ${groupBy.join(", ")}`);
  if (pivot) parts.push(`pivot ${pivot}`);
  const order = state.orderBy.filter((o) => o.target);
  if (order.length > 0) {
    for (const o of order) {
      if ((hasAgg || groupBy.length > 0) && !groupBy.includes(o.target) && !items.some((s) => s.agg && selectExpr(s) === o.target)) {
        throw new BuildError(`After grouping you can only sort by a group by column or an aggregate; ${o.target} is neither.`);
      }
      if (pivot && !groupBy.includes(o.target)) throw new BuildError("With pivot, sort only by group by columns.");
    }
    parts.push(`order by ${order.map((o) => `${o.target}${o.desc ? " desc" : ""}`).join(", ")}`);
  }
  const limit = state.limit.trim();
  if (limit) {
    if (!/^\d+$/.test(limit)) throw new BuildError("Limit must be a whole number.");
    parts.push(`limit ${limit}`);
  }
  const offset = state.offset.trim();
  if (offset) {
    if (!/^\d+$/.test(offset)) throw new BuildError("Offset must be a whole number.");
    parts.push(`offset ${offset}`);
  }
  const labelled = items.filter((s) => s.label.trim());
  if (labelled.length > 0) parts.push(`label ${labelled.map((s) => `${selectExpr(s)} ${queryString(s.label.trim())}`).join(", ")}`);
  return parts.join(" ");
}

/** The complete =QUERY(...) formula. Double quotes inside the query are doubled, as Sheets requires. */
export function toFormula(query: string, range: string, headerRows: number): string {
  const r = range.trim() || "A1:Z";
  let body = "";
  let i = 0;
  while (i < query.length) {
    const open = query.indexOf(CELL_OPEN, i);
    if (open < 0) {
      body += query.slice(i).replace(/"/g, "\"\"");
      break;
    }
    body += query.slice(i, open).replace(/"/g, "\"\"");
    const close = query.indexOf(CELL_CLOSE, open);
    body += `"&${query.slice(open + 1, close)}&"`;
    i = close + 1;
  }
  return `=QUERY(${r}, "${body}", ${headerRows})`;
}
