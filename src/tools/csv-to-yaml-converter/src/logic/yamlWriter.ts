import type { Value } from "./tree";

// Strings that YAML 1.1 or 1.2 parsers would read as something other than a string.
const SPECIAL = /^(?:y|Y|yes|Yes|YES|n|N|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF|null|Null|NULL|~|=|<<)$/;
const NUMERIC = /^[-+]?(?:\.\d+|\d[\d_]*(?:\.[\d_]*)?)(?:[eE][-+]?\d+)?$|^[-+]?0[xob][\da-fA-F_]+$|^[-+]?\.(?:inf|Inf|INF)$|^\.(?:nan|NaN|NAN)$|^[-+]?\d[\d_]*(?::[0-5]?\d)+(?:\.[\d_]*)?$/;
const DATE = /^\d{4}-\d\d?-\d\d?(?:[Tt ]|$)/;
// Control characters must be escaped, so they rule out plain and single-quoted scalars.
const CONTROL = new RegExp("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F\\u0085\\u2028\\u2029\\uFEFF]");

function needsQuotes(s: string): boolean {
  if (s === "") return true;
  if (/^[\s]|[\s]$/.test(s)) return true;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(s)) return true;
  if (/: |:$| #|\t/.test(s)) return true;
  return SPECIAL.test(s) || NUMERIC.test(s) || DATE.test(s);
}

function quoted(s: string): string {
  if (!s.includes("'") && !CONTROL.test(s) && !/[\r\n]/.test(s)) return `'${s}'`;
  // JSON string escapes are valid in YAML double-quoted scalars.
  return JSON.stringify(s);
}

export function scalar(v: string | number | boolean | null): string {
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : JSON.stringify(String(v));
  return needsQuotes(v) || CONTROL.test(v) || /[\r\n]/.test(v) ? quoted(v) : v;
}

function block(s: string, pad: string): string | null {
  // A literal block keeps multi-line text readable; it cannot start with a space, carry \r or control characters.
  if (CONTROL.test(s) || s.includes("\r")) return null;
  // The block's indentation is taken from its first line, so that line may not start with a space or be empty.
  if (/^[ \t\n]/.test(s)) return null;
  const trailing = /\n+$/.exec(s)?.[0].length ?? 0;
  const chomp = trailing === 0 ? "-" : trailing === 1 ? "" : "+";
  const body = trailing ? s.slice(0, -1) : s;
  const lines = body.split("\n").map((l) => (l === "" ? "" : pad + l));
  return `|${chomp}\n${lines.join("\n")}`;
}

function isPlainObject(v: Value): v is { [k: string]: Value } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function valueAfterKey(v: Value, pad: string): string {
  if (Array.isArray(v)) return v.length === 0 ? " []" : `\n${seq(v, pad + "  ")}`;
  if (isPlainObject(v)) return Object.keys(v).length === 0 ? " {}" : `\n${map(v, pad + "  ")}`;
  if (typeof v === "string" && v.includes("\n")) {
    const b = block(v, pad + "  ");
    if (b) return ` ${b}`;
  }
  return ` ${scalar(v as string | number | boolean | null)}`;
}

function map(obj: { [k: string]: Value }, pad: string, firstPad = pad): string {
  return Object.entries(obj)
    .map(([k, v], i) => `${i === 0 ? firstPad : pad}${scalar(k)}:${valueAfterKey(v, pad)}`)
    .join("\n");
}

function seq(list: Value[], pad: string): string {
  return list
    .map((v) => {
      if (isPlainObject(v) && Object.keys(v).length > 0) return map(v, pad + "  ", `${pad}- `);
      if (Array.isArray(v) && v.length > 0) return `${pad}-\n${seq(v, pad + "  ")}`;
      if (typeof v === "string" && v.includes("\n")) {
        const b = block(v, pad + "  ");
        if (b) return `${pad}- ${b}`;
      }
      return `${pad}- ${Array.isArray(v) ? "[]" : isPlainObject(v) ? "{}" : scalar(v as string | number | boolean | null)}`;
    })
    .join("\n");
}

/**
 * YAML for a list of records, under an optional top-level key. Written by
 * hand because the general-purpose serializer needs about 28 s for 500,000
 * rows; this one quotes every string that a YAML 1.1 or 1.2 parser could read
 * as a number, boolean, null or date.
 */
export function toYaml(records: Value[], rootKey: string): string {
  if (records.length === 0) return rootKey ? `${scalar(rootKey)}: []\n` : "[]\n";
  return rootKey ? `${scalar(rootKey)}:\n${seq(records, "  ")}\n` : `${seq(records, "")}\n`;
}
