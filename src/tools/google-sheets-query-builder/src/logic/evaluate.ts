import type { Column, Table } from "./data";
import { exprKey, hasAgg, parseQuery, QueryError, type Expr, type Query } from "./query";
import { formatValue, isDate, type ColType, type Value } from "./values";

export interface QueryResult {
  headers: string[];
  rows: Value[][];
  totalRows: number;
  ignored: string[];
}

type T = ColType | "null" | "any";

const sameType = (a: T, b: T) => a === b || a === "null" || b === "null" || a === "any" || b === "any" || ((a === "date" || a === "datetime") && (b === "date" || b === "datetime"));
const TYPE_WORD: Record<T, string> = { number: "numbers", string: "text", boolean: "TRUE/FALSE values", date: "dates", datetime: "date-times", null: "empty values", any: "values" };

function typeOf(e: Expr, cols: Map<string, Column>): T {
  switch (e.k) {
    case "col":
      return cols.get(e.id)!.type;
    case "lit":
      if (e.v === null) return "null";
      if (isDate(e.v)) return e.v.time ? "datetime" : "date";
      return typeof e.v === "number" ? "number" : typeof e.v === "boolean" ? "boolean" : "string";
    case "agg": {
      const t = typeOf(e.arg, cols);
      if ((e.fn === "sum" || e.fn === "avg") && t !== "number") throw new QueryError(`${e.fn}() only works on numbers, but ${describe(e.arg, cols)} holds ${TYPE_WORD[t]}.`);
      return e.fn === "count" ? "number" : t;
    }
    case "fn": {
      const t = typeOf(e.arg, cols);
      if (e.fn === "upper" || e.fn === "lower") {
        if (t !== "string") throw new QueryError(`${e.fn}() needs text, but ${describe(e.arg, cols)} holds ${TYPE_WORD[t]}.`);
        return "string";
      }
      if (t !== "date" && t !== "datetime") throw new QueryError(`${e.fn}() needs a date, but ${describe(e.arg, cols)} holds ${TYPE_WORD[t]}.`);
      return "number";
    }
    case "bin": {
      const l = typeOf(e.l, cols);
      const r = typeOf(e.r, cols);
      if (l !== "number" || r !== "number") throw new QueryError(`“${e.op}” only works on numbers; ${l !== "number" ? describe(e.l, cols) : describe(e.r, cols)} is not a number.`);
      return "number";
    }
    case "cmp": {
      const l = typeOf(e.l, cols);
      const r = typeOf(e.r, cols);
      if (["contains", "starts with", "ends with", "matches", "like"].includes(e.op)) {
        if (l !== "string" || r !== "string") throw new QueryError(`“${e.op}” only works on text, but ${l !== "string" ? describe(e.l, cols) : describe(e.r, cols)} holds ${TYPE_WORD[l !== "string" ? l : r]}.`);
      } else if (!sameType(l, r)) {
        const hint = r === "string" && l === "number" ? " Remove the quotes around the number." : l === "date" || l === "datetime" ? " Write dates as date 'yyyy-mm-dd'." : l === "string" ? " Put text in quotes, e.g. 'Paris'." : "";
        throw new QueryError(`${describe(e.l, cols)} holds ${TYPE_WORD[l]}, so it cannot be compared with ${TYPE_WORD[r]}.${hint}`);
      }
      return "boolean";
    }
    case "isnull":
      typeOf(e.e, cols);
      return "boolean";
    case "and":
    case "or":
      typeOf(e.l, cols);
      typeOf(e.r, cols);
      return "boolean";
    case "not":
      typeOf(e.e, cols);
      return "boolean";
  }
}

function describe(e: Expr, cols: Map<string, Column>): string {
  if (e.k === "col") {
    const c = cols.get(e.id)!;
    return c.label ? `column ${e.id} (${c.label})` : `column ${e.id}`;
  }
  return exprKey(e);
}

/** Header Google would show: the column label, or e.g. "sum Revenue" for an aggregate. */
export function defaultLabel(e: Expr, cols: Map<string, Column>): string {
  switch (e.k) {
    case "col":
      return cols.get(e.id)!.label || e.id;
    case "agg":
    case "fn":
      return `${e.fn} ${defaultLabel(e.arg, cols)}`;
    case "bin":
      return `${defaultLabel(e.l, cols)}${e.op}${defaultLabel(e.r, cols)}`;
    case "lit":
      return formatValue(e.v);
    default:
      return exprKey(e);
  }
}

function compare(a: Value, b: Value): number {
  // Empty values sort first, as in Google Sheets.
  if (a === null || b === null) return a === null ? (b === null ? 0 : -1) : 1;
  const x = isDate(a) ? a.date : a;
  const y = isDate(b) ? b.date : b;
  if (typeof x === "string" && typeof y === "string") return x < y ? -1 : x > y ? 1 : 0;
  return (x as number) < (y as number) ? -1 : (x as number) > (y as number) ? 1 : 0;
}

export interface Matcher {
  /** Builds the regex for “matches”. Injected so the worker can bound it and tests can run it directly. */
  regex: (pattern: string) => RegExp;
}

const defaultMatcher: Matcher = { regex: (p) => new RegExp(`^(?:${p})$`) };

function likeToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, "[\\s\\S]*").replace(/_/g, "[\\s\\S]");
  return new RegExp(`^${escaped}$`);
}

interface Ctx {
  row?: Value[];
  group?: Value[][];
}

function evalExpr(e: Expr, ctx: Ctx, idx: Map<string, number>, m: Matcher, cache: Map<string, RegExp>): Value {
  switch (e.k) {
    case "col": {
      const row = ctx.row ?? ctx.group?.[0];
      return row ? row[idx.get(e.id)!] : null;
    }
    case "lit":
      return e.v;
    case "agg": {
      const vals = (ctx.group ?? []).map((r) => evalExpr(e.arg, { row: r }, idx, m, cache)).filter((v) => v !== null);
      if (e.fn === "count") return vals.length;
      if (vals.length === 0) return null;
      if (e.fn === "sum" || e.fn === "avg") {
        const s = (vals as number[]).reduce((a, b) => a + b, 0);
        return e.fn === "sum" ? s : s / vals.length;
      }
      return vals.reduce((a, b) => (compare(a, b) * (e.fn === "max" ? 1 : -1) >= 0 ? a : b));
    }
    case "fn": {
      const v = evalExpr(e.arg, ctx, idx, m, cache);
      if (v === null) return null;
      if (e.fn === "upper") return (v as string).toUpperCase();
      if (e.fn === "lower") return (v as string).toLowerCase();
      const d = new Date((v as { date: number }).date);
      switch (e.fn) {
        case "year": return d.getUTCFullYear();
        case "month": return d.getUTCMonth();
        case "day": return d.getUTCDate();
        case "quarter": return Math.floor(d.getUTCMonth() / 3) + 1;
        case "dayofweek": return d.getUTCDay() + 1;
        case "hour": return d.getUTCHours();
        default: return d.getUTCMinutes();
      }
    }
    case "bin": {
      const l = evalExpr(e.l, ctx, idx, m, cache);
      const r = evalExpr(e.r, ctx, idx, m, cache);
      if (l === null || r === null) return null;
      const a = l as number;
      const b = r as number;
      return e.op === "+" ? a + b : e.op === "-" ? a - b : e.op === "*" ? a * b : b === 0 ? null : a / b;
    }
    case "cmp": {
      const l = evalExpr(e.l, ctx, idx, m, cache);
      const r = evalExpr(e.r, ctx, idx, m, cache);
      if (l === null || r === null) return false;
      switch (e.op) {
        case "=": return compare(l, r) === 0;
        case "!=": return compare(l, r) !== 0;
        case "<": return compare(l, r) < 0;
        case "<=": return compare(l, r) <= 0;
        case ">": return compare(l, r) > 0;
        case ">=": return compare(l, r) >= 0;
        case "contains": return (l as string).includes(r as string);
        case "starts with": return (l as string).startsWith(r as string);
        case "ends with": return (l as string).endsWith(r as string);
        case "like":
        case "matches": {
          const key = `${e.op}:${r as string}`;
          let re = cache.get(key);
          if (!re) {
            try {
              re = e.op === "like" ? likeToRegex(r as string) : m.regex(r as string);
            } catch {
              throw new QueryError(`“${r as string}” is not a valid regular expression for matches.`);
            }
            cache.set(key, re);
          }
          return re.test(l as string);
        }
      }
      return false;
    }
    case "isnull": {
      const v = evalExpr(e.e, ctx, idx, m, cache);
      return e.not ? v !== null : v === null;
    }
    case "and":
      return evalExpr(e.l, ctx, idx, m, cache) === true && evalExpr(e.r, ctx, idx, m, cache) === true;
    case "or":
      return evalExpr(e.l, ctx, idx, m, cache) === true || evalExpr(e.r, ctx, idx, m, cache) === true;
    case "not":
      return evalExpr(e.e, ctx, idx, m, cache) !== true;
  }
}

function columnsIn(e: Expr, out: string[] = []): string[] {
  if (e.k === "col") out.push(e.id);
  else if (e.k === "agg") return out;
  else if (e.k === "fn") columnsIn(e.arg, out);
  else if (e.k === "bin" || e.k === "cmp" || e.k === "and" || e.k === "or") {
    columnsIn(e.l, out);
    columnsIn(e.r, out);
  } else if (e.k === "isnull" || e.k === "not") columnsIn(e.e, out);
  return out;
}

/** Runs a QUERY string over a table. Supported subset: see README. */
export function runQuery(table: Table, src: string, matcher: Matcher = defaultMatcher): QueryResult {
  const cols = new Map(table.columns.map((c) => [c.id, c]));
  const idx = new Map(table.columns.map((c, i) => [c.id, i]));
  const q: Query = parseQuery(src, table.columns.map((c) => c.id));
  const cache = new Map<string, RegExp>();
  const select: Expr[] = q.select === "*" ? table.columns.map((c) => ({ k: "col", id: c.id })) : q.select;

  for (const e of select) typeOf(e, cols);
  if (q.where) {
    if (hasAgg(q.where)) throw new QueryError("where cannot use sum(), count() and other aggregates; it filters rows before grouping.");
    if (typeOf(q.where, cols) !== "boolean") throw new QueryError("where needs a condition, e.g. where C > 100.");
  }
  for (const g of [...q.groupBy, ...q.pivot]) {
    typeOf(g, cols);
    if (hasAgg(g)) throw new QueryError("group by and pivot cannot contain aggregates.");
  }
  for (const o of q.orderBy) typeOf(o.e, cols);

  const grouped = q.groupBy.length > 0 || q.pivot.length > 0 || select.some(hasAgg);
  const groupKeys = new Set(q.groupBy.map(exprKey));
  const pivotKeys = new Set(q.pivot.map(exprKey));
  if (grouped) {
    for (const e of select) {
      if (hasAgg(e)) continue;
      const key = exprKey(e);
      if (pivotKeys.has(key)) throw new QueryError(`${defaultLabel(e, cols)} is used in pivot, so it cannot also be selected.`);
      if (!groupKeys.has(key)) throw new QueryError(`${describe(e, cols)} must either be inside an aggregate (sum, count…) or listed in group by.`);
    }
    for (const g of q.groupBy) if (pivotKeys.has(exprKey(g))) throw new QueryError(`${defaultLabel(g, cols)} cannot be in both group by and pivot.`);
    if (q.pivot.length > 0 && !select.some(hasAgg)) throw new QueryError("pivot needs at least one aggregate in select, e.g. select A, sum(D) … pivot B.");
  }
  const labels = new Map<string, string>();
  for (const l of q.labels) {
    const key = exprKey(l.e);
    if (!select.some((s) => exprKey(s) === key)) throw new QueryError(`label refers to ${defaultLabel(l.e, cols)}, which is not in select.`);
    labels.set(key, l.text);
  }

  let rows = table.rows;
  if (q.where) rows = rows.filter((r) => evalExpr(q.where!, { row: r }, idx, matcher, cache) === true);

  let headers: string[];
  let out: Value[][];
  if (!grouped) {
    headers = select.map((e) => labels.get(exprKey(e)) ?? defaultLabel(e, cols));
    let ordered = rows;
    if (q.orderBy.length > 0) {
      const keyed = rows.map((r) => ({ r, k: q.orderBy.map((o) => evalExpr(o.e, { row: r }, idx, matcher, cache)) }));
      keyed.sort((a, b) => {
        for (let i = 0; i < q.orderBy.length; i++) {
          const c = compare(a.k[i], b.k[i]);
          if (c !== 0) return q.orderBy[i].desc ? -c : c;
        }
        return 0;
      });
      ordered = keyed.map((x) => x.r);
    }
    out = ordered.map((r) => select.map((e) => evalExpr(e, { row: r }, idx, matcher, cache)));
  } else {
    const groups = new Map<string, { key: Value[]; rows: Value[][] }>();
    for (const r of rows) {
      const key = q.groupBy.map((g) => evalExpr(g, { row: r }, idx, matcher, cache));
      const k = JSON.stringify(key);
      let g = groups.get(k);
      if (!g) groups.set(k, (g = { key, rows: [] }));
      g.rows.push(r);
    }
    if (groups.size === 0 && q.groupBy.length === 0) groups.set("[]", { key: [], rows: [] });
    // Google returns groups sorted by the group-by values.
    let list = [...groups.values()].sort((a, b) => {
      for (let i = 0; i < a.key.length; i++) {
        const c = compare(a.key[i], b.key[i]);
        if (c !== 0) return c;
      }
      return 0;
    });
    const aggs = select.filter(hasAgg);
    if (q.pivot.length > 0) {
      const pv = new Map<string, Value[]>();
      for (const r of rows) {
        const v = q.pivot.map((pe) => evalExpr(pe, { row: r }, idx, matcher, cache));
        pv.set(JSON.stringify(v), v);
      }
      const pivots = [...pv.values()].sort((a, b) => {
        for (let i = 0; i < a.length; i++) {
          const c = compare(a[i], b[i]);
          if (c !== 0) return c;
        }
        return 0;
      });
      const plain = select.filter((e) => !hasAgg(e));
      headers = [
        ...plain.map((e) => labels.get(exprKey(e)) ?? defaultLabel(e, cols)),
        ...pivots.flatMap((pvals) => aggs.map((a) => {
          const name = pvals.map(formatValue).join(", ");
          return aggs.length === 1 ? name : `${name} ${labels.get(exprKey(a)) ?? defaultLabel(a, cols)}`;
        })),
      ];
      for (const o of q.orderBy) if (!groupKeys.has(exprKey(o.e))) throw new QueryError("With pivot, order by can only use the group by columns.");
      if (q.orderBy.length > 0) list = sortGroups(list, q, idx, matcher, cache);
      out = list.map((g) => [
        ...plain.map((e) => evalExpr(e, { group: g.rows }, idx, matcher, cache)),
        ...pivots.flatMap((pvals) => {
          const sub = g.rows.filter((r) => q.pivot.every((pe, i) => compare(evalExpr(pe, { row: r }, idx, matcher, cache), pvals[i]) === 0));
          return aggs.map((a) => (sub.length === 0 ? null : evalExpr(a, { group: sub }, idx, matcher, cache)));
        }),
      ]);
    } else {
      headers = select.map((e) => labels.get(exprKey(e)) ?? defaultLabel(e, cols));
      for (const o of q.orderBy) {
        if (!hasAgg(o.e) && columnsIn(o.e).some((c) => !q.groupBy.some((g) => g.k === "col" && g.id === c))) {
          throw new QueryError(`order by ${defaultLabel(o.e, cols)} is not possible after grouping; order by a group by column or an aggregate.`);
        }
      }
      if (q.orderBy.length > 0) list = sortGroups(list, q, idx, matcher, cache);
      out = list.map((g) => select.map((e) => evalExpr(e, { group: g.rows }, idx, matcher, cache)));
    }
  }
  const start = Math.min(q.offset, out.length);
  const sliced = out.slice(start, q.limit !== null ? start + q.limit : undefined);
  return { headers, rows: sliced, totalRows: sliced.length, ignored: q.ignored };
}

function sortGroups(list: { key: Value[]; rows: Value[][] }[], q: Query, idx: Map<string, number>, m: Matcher, cache: Map<string, RegExp>) {
  const keyed = list.map((g) => ({ g, k: q.orderBy.map((o) => evalExpr(o.e, { group: g.rows }, idx, m, cache)) }));
  keyed.sort((a, b) => {
    for (let i = 0; i < q.orderBy.length; i++) {
      const c = compare(a.k[i], b.k[i]);
      if (c !== 0) return q.orderBy[i].desc ? -c : c;
    }
    return 0;
  });
  return keyed.map((x) => x.g);
}
