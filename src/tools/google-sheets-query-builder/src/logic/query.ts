import { parseDate, type Value } from "./values";

export type AggFn = "sum" | "avg" | "count" | "max" | "min";
export const AGG_FNS: AggFn[] = ["sum", "avg", "count", "max", "min"];
export const SCALAR_FNS = ["year", "month", "day", "quarter", "dayofweek", "hour", "minute", "upper", "lower"] as const;
export type ScalarFn = (typeof SCALAR_FNS)[number];
export type CmpOp = "=" | "!=" | "<" | "<=" | ">" | ">=" | "contains" | "starts with" | "ends with" | "matches" | "like";

export type Expr =
  | { k: "col"; id: string }
  | { k: "lit"; v: Value }
  | { k: "agg"; fn: AggFn; arg: Expr }
  | { k: "fn"; fn: ScalarFn; arg: Expr }
  | { k: "bin"; op: "+" | "-" | "*" | "/"; l: Expr; r: Expr }
  | { k: "cmp"; op: CmpOp; l: Expr; r: Expr }
  | { k: "isnull"; not: boolean; e: Expr }
  | { k: "and" | "or"; l: Expr; r: Expr }
  | { k: "not"; e: Expr };

export interface Query {
  select: Expr[] | "*";
  where: Expr | null;
  groupBy: Expr[];
  pivot: Expr[];
  orderBy: { e: Expr; desc: boolean }[];
  limit: number | null;
  offset: number;
  labels: { e: Expr; text: string }[];
  /** Clauses the preview does not apply (format, options); the formula keeps them. */
  ignored: string[];
}

export class QueryError extends Error {}

type Tok = { t: "id" | "num" | "str" | "op" | "punct"; v: string; pos: number };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "'" || ch === "\"") {
      const end = src.indexOf(ch, i + 1);
      if (end < 0) throw new QueryError(`A text value starting at position ${i + 1} is missing its closing ${ch}.`);
      out.push({ t: "str", v: src.slice(i + 1, end), pos: i });
      i = end + 1;
      continue;
    }
    if (ch === "`") {
      const end = src.indexOf("`", i + 1);
      if (end < 0) throw new QueryError("A `column` name is missing its closing back-quote.");
      out.push({ t: "id", v: src.slice(i + 1, end), pos: i });
      i = end + 1;
      continue;
    }
    const num = /^\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|^\.\d+/.exec(src.slice(i));
    if (num) {
      out.push({ t: "num", v: num[0], pos: i });
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (id) {
      out.push({ t: "id", v: id[0], pos: i });
      i += id[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === "!=" || two === "<>" || two === "<=" || two === ">=") {
      out.push({ t: "op", v: two === "<>" ? "!=" : two, pos: i });
      i += 2;
      continue;
    }
    if ("=<>+-*/".includes(ch)) {
      out.push({ t: "op", v: ch, pos: i });
      i++;
      continue;
    }
    if ("(),".includes(ch)) {
      out.push({ t: "punct", v: ch, pos: i });
      i++;
      continue;
    }
    throw new QueryError(`Unexpected character “${ch}” at position ${i + 1}.`);
  }
  return out;
}

const CLAUSES = ["select", "where", "group by", "pivot", "order by", "limit", "offset", "label", "format", "options"];

/** Parses the QUERY language. Known column ids are needed to tell columns from misspelt keywords. */
export function parseQuery(src: string, columnIds: string[]): Query {
  const toks = tokenize(src);
  let p = 0;
  const ids = new Map(columnIds.map((c) => [c.toUpperCase(), c]));
  const peek = (o = 0) => toks[p + o];
  const kw = (word: string, o = 0) => peek(o)?.t === "id" && peek(o)!.v.toLowerCase() === word;
  const kw2 = (a: string, b: string) => kw(a) && kw(b, 1);
  const clauseAt = (): string | null => {
    for (const c of CLAUSES) {
      const [a, b] = c.split(" ");
      if (b ? kw2(a, b) : kw(a)) return c;
    }
    return null;
  };
  const expectPunct = (v: string) => {
    if (peek()?.t !== "punct" || peek()!.v !== v) throw new QueryError(`Expected “${v}”${peek() ? ` near “${peek()!.v}”` : " at the end"}.`);
    p++;
  };

  const primary = (): Expr => {
    const t = peek();
    if (!t) throw new QueryError("The query ends too early; something is missing after the last word.");
    if (t.t === "punct" && t.v === "(") {
      p++;
      const e = orExpr();
      expectPunct(")");
      return e;
    }
    if (t.t === "num") {
      p++;
      return { k: "lit", v: Number(t.v) };
    }
    if (t.t === "op" && t.v === "-") {
      p++;
      const inner = primary();
      if (inner.k === "lit" && typeof inner.v === "number") return { k: "lit", v: -inner.v };
      return { k: "bin", op: "-", l: { k: "lit", v: 0 }, r: inner };
    }
    if (t.t === "str") {
      p++;
      return { k: "lit", v: t.v };
    }
    if (t.t === "id") {
      const lower = t.v.toLowerCase();
      if ((lower === "date" || lower === "datetime") && peek(1)?.t === "str") {
        p += 2;
        const d = parseDate(peek(-1)!.v);
        if (!d || (lower === "date" && d.time)) throw new QueryError(`${lower} '${peek(-1)!.v}' is not valid. Write dates as date 'yyyy-mm-dd'${lower === "datetime" ? " and date-times as datetime 'yyyy-mm-dd hh:mm:ss'" : ""}.`);
        return { k: "lit", v: { date: d.date, time: lower === "datetime" } };
      }
      if (lower === "true" || lower === "false") {
        p++;
        return { k: "lit", v: lower === "true" };
      }
      if (lower === "null") {
        p++;
        return { k: "lit", v: null };
      }
      if (peek(1)?.t === "punct" && peek(1)!.v === "(") {
        p += 2;
        if ((AGG_FNS as string[]).includes(lower)) {
          const arg = orExpr();
          expectPunct(")");
          return { k: "agg", fn: lower as AggFn, arg };
        }
        if ((SCALAR_FNS as readonly string[]).includes(lower)) {
          const arg = orExpr();
          expectPunct(")");
          return { k: "fn", fn: lower as ScalarFn, arg };
        }
        throw new QueryError(`The function ${t.v}() is not supported by this preview. Supported: ${[...AGG_FNS, ...SCALAR_FNS].join(", ")}.`);
      }
      const id = ids.get(t.v.toUpperCase());
      if (id) {
        p++;
        return { k: "col", id };
      }
      throw new QueryError(`“${t.v}” is not a column in this data. Columns are ${columnIds.slice(0, 8).join(", ")}${columnIds.length > 8 ? ", …" : ""}.`);
    }
    throw new QueryError(`Unexpected “${t.v}”.`);
  };

  const term = (): Expr => {
    let e = primary();
    while (peek()?.t === "op" && (peek()!.v === "*" || peek()!.v === "/")) {
      const op = peek()!.v as "*" | "/";
      p++;
      e = { k: "bin", op, l: e, r: primary() };
    }
    return e;
  };
  const sum = (): Expr => {
    let e = term();
    while (peek()?.t === "op" && (peek()!.v === "+" || peek()!.v === "-")) {
      const op = peek()!.v as "+" | "-";
      p++;
      e = { k: "bin", op, l: e, r: term() };
    }
    return e;
  };
  const comparison = (): Expr => {
    const l = sum();
    const t = peek();
    if (t?.t === "op" && ["=", "!=", "<", "<=", ">", ">="].includes(t.v)) {
      p++;
      return { k: "cmp", op: t.v as CmpOp, l, r: sum() };
    }
    if (kw("is")) {
      p++;
      const not = kw("not");
      if (not) p++;
      if (!kw("null")) throw new QueryError("After “is” write “null” or “not null”.");
      p++;
      return { k: "isnull", not, e: l };
    }
    for (const op of ["contains", "starts with", "ends with", "matches", "like"] as const) {
      const [a, b] = op.split(" ");
      if (b ? kw2(a, b) : kw(a)) {
        p += b ? 2 : 1;
        return { k: "cmp", op, l, r: sum() };
      }
    }
    return l;
  };
  const notExpr = (): Expr => {
    if (kw("not")) {
      p++;
      return { k: "not", e: notExpr() };
    }
    return comparison();
  };
  const andExpr = (): Expr => {
    let e = notExpr();
    while (kw("and")) {
      p++;
      e = { k: "and", l: e, r: notExpr() };
    }
    return e;
  };
  const orExpr = (): Expr => {
    let e = andExpr();
    while (kw("or")) {
      p++;
      e = { k: "or", l: e, r: andExpr() };
    }
    return e;
  };
  const list = (): Expr[] => {
    const items = [orExpr()];
    while (peek()?.t === "punct" && peek()!.v === ",") {
      p++;
      items.push(orExpr());
    }
    return items;
  };
  const int = (what: string): number => {
    const t = peek();
    if (t?.t !== "num" || !/^\d+$/.test(t.v)) throw new QueryError(`${what} must be followed by a whole number.`);
    p++;
    return Number(t.v);
  };

  const q: Query = { select: "*", where: null, groupBy: [], pivot: [], orderBy: [], limit: null, offset: 0, labels: [], ignored: [] };
  let last = -1;
  while (p < toks.length) {
    const c = clauseAt();
    if (!c) throw new QueryError(`Unexpected “${peek()!.v}”. Each part must start with select, where, group by, pivot, order by, limit, offset, label, format or options.`);
    const idx = CLAUSES.indexOf(c);
    if (idx <= last) throw new QueryError(`“${c}” is in the wrong place. Clauses must come in this order: ${CLAUSES.join(", ")}; each at most once.`);
    last = idx;
    p += c.includes(" ") ? 2 : 1;
    if (c === "select") {
      if (peek()?.t === "op" && peek()!.v === "*") {
        p++;
        q.select = "*";
      } else q.select = list();
    } else if (c === "where") q.where = orExpr();
    else if (c === "group by") q.groupBy = list();
    else if (c === "pivot") q.pivot = list();
    else if (c === "order by") {
      do {
        if (q.orderBy.length > 0) p++;
        const e = orExpr();
        let desc = false;
        if (kw("desc")) {
          desc = true;
          p++;
        } else if (kw("asc")) p++;
        q.orderBy.push({ e, desc });
      } while (peek()?.t === "punct" && peek()!.v === ",");
    } else if (c === "limit") q.limit = int("limit");
    else if (c === "offset") q.offset = int("offset");
    else if (c === "label") {
      do {
        if (q.labels.length > 0) p++;
        const e = orExpr();
        const t = peek();
        if (t?.t !== "str") throw new QueryError("Each label needs a text in quotes, e.g. label sum(D) 'Total'.");
        p++;
        q.labels.push({ e, text: t.v });
      } while (peek()?.t === "punct" && peek()!.v === ",");
    } else {
      // format/options do not change which rows come back; skip to the next clause.
      const start = p;
      while (p < toks.length && !clauseAt()) p++;
      q.ignored.push(`${c} ${toks.slice(start, p).map((t) => (t.t === "str" ? `'${t.v}'` : t.v)).join(" ")}`);
    }
  }
  return q;
}

/** Canonical text of an expression; used to match labels and group by items with select items. */
export function exprKey(e: Expr): string {
  switch (e.k) {
    case "col":
      return e.id;
    case "lit":
      return JSON.stringify(e.v);
    case "agg":
    case "fn":
      return `${e.fn}(${exprKey(e.arg)})`;
    case "bin":
      return `(${exprKey(e.l)}${e.op}${exprKey(e.r)})`;
    case "cmp":
      return `(${exprKey(e.l)} ${e.op} ${exprKey(e.r)})`;
    case "isnull":
      return `(${exprKey(e.e)} is ${e.not ? "not " : ""}null)`;
    case "and":
    case "or":
      return `(${exprKey(e.l)} ${e.k} ${exprKey(e.r)})`;
    case "not":
      return `(not ${exprKey(e.e)})`;
  }
}

export function hasAgg(e: Expr): boolean {
  switch (e.k) {
    case "agg":
      return true;
    case "fn":
      return hasAgg(e.arg);
    case "bin":
    case "cmp":
    case "and":
    case "or":
      return hasAgg(e.l) || hasAgg(e.r);
    case "isnull":
    case "not":
      return hasAgg(e.e);
    default:
      return false;
  }
}
