import type { JsonValue } from "./model";

/** Python string literal with double quotes; non-printable characters as escapes. */
export function pyStr(s: string): string {
  let out = "\"";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === "\"") out += "\\\"";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (c < 0x20 || c === 0x7f) out += `\\x${c.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return out + "\"";
}

/** JavaScript string literal (JSON-compatible double-quoted form). */
export function jsStr(s: string): string {
  return JSON.stringify(s).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** PHP single-quoted literal; only \ and ' need escaping, so $ is never interpolated. */
export function phpStr(s: string): string {
  if (/[\x00-\x1f]/.test(s)) {
    // Control characters need a double-quoted string; escape $ so nothing is interpolated.
    return "\"" + s.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\$/g, "\\$").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t").replace(/[\x00-\x1f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`) + "\"";
  }
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** Go interpreted string literal (JSON escaping is valid Go). */
export function goStr(s: string): string {
  return jsStr(s);
}

/** Go raw string when the text has no backquote, which keeps JSON bodies readable. */
export function goRaw(s: string): string {
  return s.includes("`") ? goStr(s) : `\`${s}\``;
}

const pad = (n: number) => "    ".repeat(n);
const jsPad = (n: number) => "  ".repeat(n);

/** JSON value as a Python literal: True/False/None, dicts and lists, 4-space indents. */
export function pyValue(v: JsonValue, depth = 0): string {
  if (v === null) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return pyStr(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    return `[\n${v.map((x) => pad(depth + 1) + pyValue(x, depth + 1)).join(",\n")},\n${pad(depth)}]`;
  }
  const keys = Object.keys(v);
  if (keys.length === 0) return "{}";
  return `{\n${keys.map((k) => `${pad(depth + 1)}${pyStr(k)}: ${pyValue(v[k], depth + 1)}`).join(",\n")},\n${pad(depth)}}`;
}

const JS_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function jsKey(k: string): string {
  return JS_IDENT.test(k) ? k : jsStr(k);
}

/** JSON value as a JavaScript literal with unquoted keys where possible, 2-space indents. */
export function jsValue(v: JsonValue, depth = 0): string {
  if (v === null || typeof v === "boolean" || typeof v === "number") return String(v);
  if (typeof v === "string") return jsStr(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    return `[\n${v.map((x) => jsPad(depth + 1) + jsValue(x, depth + 1)).join(",\n")},\n${jsPad(depth)}]`;
  }
  const keys = Object.keys(v);
  if (keys.length === 0) return "{}";
  return `{\n${keys.map((k) => `${jsPad(depth + 1)}${jsKey(k)}: ${jsValue(v[k], depth + 1)}`).join(",\n")},\n${jsPad(depth)}}`;
}

export function indent(text: string, by: string): string {
  return text.split("\n").map((l, i) => (i === 0 ? l : by + l)).join("\n");
}
