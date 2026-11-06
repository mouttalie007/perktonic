import type { ColumnType } from "./types";

const INT = /^[+-]?(0|[1-9]\d*)$/;
const DEC = /^[+-]?(0|[1-9]\d*)?\.\d+$|^[+-]?(0|[1-9]\d*)\.\d*$/;
const BOOL = /^(true|false|yes|no)$/i;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TS = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?$/;
// BigInt() rather than 123n literals: the site compiles for targets older than ES2020.
const INT32_MAX = BigInt(2147483647);
const INT32_MIN = BigInt(-2147483648);
const INT64_MAX = BigInt("9223372036854775807");
const INT64_MIN = BigInt("-9223372036854775808");

function validDate(y: string, m: string, d: string): boolean {
  const mm = Number(m);
  const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1) return false;
  return dd <= new Date(Date.UTC(Number(y), mm, 0)).getUTCDate();
}

export function isDate(v: string): boolean {
  const m = DATE.exec(v);
  return m !== null && validDate(m[1], m[2], m[3]);
}

export function timestampParts(v: string): { zone: boolean } | null {
  const m = TS.exec(v);
  if (!m || !validDate(m[1], m[2], m[3])) return null;
  if (Number(m[4]) > 23 || Number(m[5]) > 59 || (m[6] !== undefined && Number(m[6]) > 59)) return null;
  return { zone: m[8] !== undefined };
}

export function isBoolean(v: string): boolean {
  return BOOL.test(v);
}

export function boolValue(v: string): boolean {
  return /^(true|yes)$/i.test(v);
}

/** Does `v` fit the type? Used to check every row, not only the sample, when the SQL is written. */
export function fits(v: string, type: ColumnType): boolean {
  switch (type) {
    case "integer":
      return INT.test(v) && BigInt(v) <= INT32_MAX && BigInt(v) >= INT32_MIN;
    case "bigint":
      return INT.test(v) && BigInt(v) <= INT64_MAX && BigInt(v) >= INT64_MIN;
    case "decimal":
      return INT.test(v) || DEC.test(v);
    case "boolean":
      return isBoolean(v);
    case "date":
      return isDate(v);
    case "timestamp":
      return timestampParts(v) !== null || isDate(v);
    case "text":
      return true;
  }
}

export interface Inferred {
  type: ColumnType;
  reason: string;
  precision: number;
  scale: number;
  maxLength: number;
  hasZone: boolean;
}

const n = (x: number) => x.toLocaleString("en-US");

/**
 * Picks the narrowest type that every filled value fits, in this order:
 * boolean, integer, bigint, decimal, date, timestamp, text. Whole numbers
 * with leading zeros (ZIP codes, 007) stay text so the zeros survive.
 */
export function inferType(values: string[]): Inferred {
  const filled = values.filter((v) => v !== "");
  let maxLength = 0;
  for (const v of values) if (v.length > maxLength) maxLength = v.length;
  const base = { precision: 0, scale: 0, maxLength, hasZone: false };
  if (filled.length === 0) return { ...base, type: "text", reason: "the column is empty in the sample, so text is the safe choice" };
  const all = (re: (v: string) => boolean) => filled.every(re);
  const count = n(filled.length);
  if (all(isBoolean)) return { ...base, type: "boolean", reason: `all ${count} filled values are true/false or yes/no` };
  if (all((v) => INT.test(v))) {
    let big = false;
    let tooBig = false;
    let digits = 1;
    for (const v of filled) {
      const b = BigInt(v);
      if (b > INT32_MAX || b < INT32_MIN) big = true;
      if (b > INT64_MAX || b < INT64_MIN) tooBig = true;
      digits = Math.max(digits, v.replace(/^[+-]/, "").length);
    }
    if (tooBig) return { ...base, type: "decimal", precision: Math.min(38, digits), scale: 0, reason: `whole numbers up to ${digits} digits, too large for BIGINT` };
    return { ...base, type: big ? "bigint" : "integer", reason: big ? `whole numbers beyond ±2,147,483,647 (${count} values)` : `all ${count} filled values are whole numbers` };
  }
  if (filled.some((v) => /^[+-]?0\d+$/.test(v)) && all((v) => /^[+-]?\d+$/.test(v))) {
    return { ...base, type: "text", reason: "whole numbers with leading zeros (such as codes or ZIP codes); text keeps the zeros" };
  }
  if (all((v) => INT.test(v) || DEC.test(v))) {
    let intDigits = 1;
    let scale = 0;
    for (const v of filled) {
      const [i, f = ""] = v.replace(/^[+-]/, "").split(".");
      intDigits = Math.max(intDigits, i.replace(/^0+(?=\d)/, "").length || 1);
      scale = Math.max(scale, f.length);
    }
    const precision = Math.min(38, intDigits + scale);
    return { ...base, type: "decimal", precision, scale: Math.min(scale, precision), reason: `numbers with up to ${scale} decimal place${scale === 1 ? "" : "s"}` };
  }
  if (all(isDate)) return { ...base, type: "date", reason: `all ${count} filled values are dates (YYYY-MM-DD)` };
  if (all((v) => timestampParts(v) !== null || isDate(v))) {
    const hasZone = filled.some((v) => timestampParts(v)?.zone);
    return { ...base, type: "timestamp", hasZone, reason: `date and time values (YYYY-MM-DD hh:mm${hasZone ? " with a time zone" : ""})` };
  }
  const odd = filled.find((v) => !(INT.test(v) || DEC.test(v)));
  const looksNumeric = filled.filter((v) => INT.test(v) || DEC.test(v)).length / filled.length > 0.8;
  return { ...base, type: "text", reason: looksNumeric && odd ? `mostly numbers, but “${odd.slice(0, 30)}” is not` : "free text" };
}
