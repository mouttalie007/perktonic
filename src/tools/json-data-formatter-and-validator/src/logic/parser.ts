/**
 * Lossless JSON parser. Numbers keep their exact source text (so 2^53 and
 * larger integers, 1.10 or 1e400 are never rounded), strings keep their raw
 * escapes, keys keep their order (including numeric-looking keys, which JS
 * objects would reorder) and every node records its source offset.
 */
export type Node =
  | { t: "object"; keys: string[]; rawKeys: string[]; keyAt: number[]; values: Node[]; at: number }
  | { t: "array"; items: Node[]; at: number }
  | { t: "string"; value: string; raw: string; at: number }
  | { t: "number"; raw: string; at: number }
  | { t: "boolean"; value: boolean; at: number }
  | { t: "null"; at: number };

export interface ParseNotes {
  comments: number;
  trailingCommas: number;
  /** Offset of the first comment or trailing comma, for the "this is JSONC" message. */
  firstJsonc: number | null;
  duplicateKeys: { key: string; at: number }[];
}

export class JsonSyntaxError extends Error {
  constructor(
    message: string,
    public readonly offset: number,
  ) {
    super(message);
  }
}

const WS = new Set([0x20, 0x0a, 0x0d, 0x09]);

export function parseJson(src: string, opts: { lenient: boolean }): { root: Node; notes: ParseNotes } {
  let i = src.charCodeAt(0) === 0xfeff ? 1 : 0;
  const n = src.length;
  const notes: ParseNotes = { comments: 0, trailingCommas: 0, firstJsonc: null, duplicateKeys: [] };
  const fail = (msg: string, at = i): never => {
    throw new JsonSyntaxError(msg, at);
  };

  const jsonc = (at: number, what: string) => {
    if (notes.firstJsonc === null) notes.firstJsonc = at;
    if (!opts.lenient) fail(`${what} are not allowed in JSON. Remove them, or turn on “Allow comments and trailing commas (JSONC)”.`, at);
  };

  const skip = () => {
    for (;;) {
      while (i < n && WS.has(src.charCodeAt(i))) i++;
      if (src.charCodeAt(i) === 0x2f && (src[i + 1] === "/" || src[i + 1] === "*")) {
        const at = i;
        jsonc(at, "Comments");
        notes.comments++;
        if (src[i + 1] === "/") {
          const end = src.indexOf("\n", i);
          i = end < 0 ? n : end + 1;
        } else {
          const end = src.indexOf("*/", i + 2);
          if (end < 0) fail("A /* comment is never closed with */.", at);
          i = end + 2;
        }
        continue;
      }
      return;
    }
  };

  const describeChar = (at: number) => {
    if (at >= n) return "the end of the text";
    const ch = src[at];
    if (ch === "\"") return "the start of another string";
    return ch === "\n" ? "a line break" : `“${ch}”`;
  };

  const parseString = (): { value: string; raw: string } => {
    const start = i;
    i++;
    let value = "";
    let chunk = i;
    for (;;) {
      if (i >= n) fail("A string is missing its closing double quote.", start);
      const c = src.charCodeAt(i);
      if (c === 0x22) break;
      if (c < 0x20) fail(c === 0x0a ? "A string runs past the end of the line. Close it with \" or write the line break as \\n." : "Strings cannot contain raw control characters such as tabs; write them as \\t, \\n and so on.");
      if (c === 0x5c) {
        value += src.slice(chunk, i);
        const e = src[i + 1];
        const simple: Record<string, string> = { "\"": "\"", "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
        if (e === "u") {
          const hex = src.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail("\\u must be followed by exactly 4 hex digits, e.g. \\u00e9.");
          value += String.fromCharCode(parseInt(hex, 16));
          i += 6;
        } else if (e !== undefined && e in simple) {
          value += simple[e];
          i += 2;
        } else fail(`\\${e ?? ""} is not a valid escape. Use \\\\ for a backslash.`);
        chunk = i;
        continue;
      }
      i++;
    }
    value += src.slice(chunk, i);
    i++;
    return { value, raw: src.slice(start, i) };
  };

  const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?/y;

  const value = (): Node => {
    skip();
    const at = i;
    if (i >= n) fail("The JSON ends too early: a value is missing.");
    const c = src[i];
    if (c === "{") {
      i++;
      const node: Node = { t: "object", keys: [], rawKeys: [], keyAt: [], values: [], at };
      const seen = new Set<string>();
      skip();
      if (src[i] === "}") {
        i++;
        return node;
      }
      for (;;) {
        skip();
        if (src[i] === "}" && node.keys.length > 0) {
          jsonc(i, "Trailing commas");
          notes.trailingCommas++;
          i++;
          return node;
        }
        if (src[i] !== "\"") {
          if (src[i] === "'") fail("Keys and strings must use double quotes (\"), not single quotes.");
          if (/[A-Za-z_$]/.test(src[i] ?? "")) fail("Object keys must be in double quotes, e.g. \"name\": 1.");
          fail(i >= n ? "The JSON ends too early: an object is missing its closing }." : `Expected a key in double quotes, but found ${describeChar(i)}.`);
        }
        const keyAt = i;
        const k = parseString();
        if (seen.has(k.value)) notes.duplicateKeys.push({ key: k.value, at: keyAt });
        seen.add(k.value);
        skip();
        if (src[i] !== ":") fail(`Expected a colon after the key ${k.raw}, but found ${describeChar(i)}.`);
        i++;
        node.keys.push(k.value);
        node.rawKeys.push(k.raw);
        node.keyAt.push(keyAt);
        node.values.push(value());
        skip();
        if (src[i] === ",") {
          i++;
          continue;
        }
        if (src[i] === "}") {
          i++;
          return node;
        }
        fail(i >= n ? "The JSON ends too early: an object is missing its closing }." : `Expected a comma or } after the value, but found ${describeChar(i)}. A comma is probably missing.`);
      }
    }
    if (c === "[") {
      i++;
      const node: Node = { t: "array", items: [], at };
      skip();
      if (src[i] === "]") {
        i++;
        return node;
      }
      for (;;) {
        skip();
        if (src[i] === "]" && node.items.length > 0) {
          jsonc(i, "Trailing commas");
          notes.trailingCommas++;
          i++;
          return node;
        }
        node.items.push(value());
        skip();
        if (src[i] === ",") {
          i++;
          continue;
        }
        if (src[i] === "]") {
          i++;
          return node;
        }
        fail(i >= n ? "The JSON ends too early: an array is missing its closing ]." : `Expected a comma or ] after the value, but found ${describeChar(i)}. A comma is probably missing.`);
      }
    }
    if (c === "\"") {
      const s = parseString();
      return { t: "string", value: s.value, raw: s.raw, at };
    }
    if (c === "'") fail("Strings must use double quotes (\"), not single quotes.");
    if (c === "-" || (c >= "0" && c <= "9")) {
      NUMBER.lastIndex = i;
      const m = NUMBER.exec(src);
      if (!m) fail("A minus sign must be followed by a digit.");
      const raw = m![0];
      i += raw.length;
      if (/^-?0\d/.test(src.slice(at, at + 3)) || /[\d.]/.test(src[i] ?? "")) fail("Numbers cannot have leading zeros (write 7, not 007) and need digits after a decimal point.", at);
      return { t: "number", raw, at };
    }
    const word = /^[A-Za-z]+/.exec(src.slice(i, i + 12))?.[0] ?? "";
    if (word === "true" || word === "false") {
      i += word.length;
      return { t: "boolean", value: word === "true", at };
    }
    if (word === "null") {
      i += 4;
      return { t: "null", at };
    }
    if (["NaN", "Infinity", "undefined", "True", "False", "None", "NULL"].includes(word)) {
      fail(`${word} is not valid JSON. Use ${word === "True" || word === "False" ? word.toLowerCase() : word === "None" || word === "NULL" || word === "undefined" ? "null" : "a number or null"} instead.`);
    }
    if (c === "+" || c === ".") fail("Numbers in JSON cannot start with + or a decimal point; write 0.5, not .5.");
    if (c === "}" || c === "]" || c === ",") fail(`Unexpected ${describeChar(i)}: a value is missing here.`);
    return fail(`Unexpected ${describeChar(i)}. A value must be an object, array, string in double quotes, number, true, false or null.`);
  };

  const root = value();
  skip();
  if (i < n) fail(`Unexpected ${describeChar(i)} after the end of the JSON. Is there a second value, or a missing [ … ] around a list?`);
  return { root, notes };
}

/** 1-based line and column of an offset, plus the line's text for the pointer display. */
export function locate(src: string, offset: number): { line: number; column: number; lineText: string } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < src.length; i++) {
    if (src.charCodeAt(i) === 0x0a) {
      line++;
      lineStart = i + 1;
    }
  }
  const end = src.indexOf("\n", lineStart);
  const lineText = src.slice(lineStart, end < 0 ? src.length : end).replace(/\r$/, "");
  return { line, column: offset - lineStart + 1, lineText };
}

/** The line around the error with a ^ under the column; long lines are cut to a 100-character window. */
export function pointer(lineText: string, column: number): string {
  const width = 100;
  const start = Math.max(0, Math.min(column - 1 - width / 2, lineText.length - width));
  const slice = lineText.slice(start, start + width).replace(/\t/g, " ");
  const prefix = start > 0 ? "…" : "";
  return `${prefix}${slice}\n${" ".repeat(prefix.length + column - 1 - start)}^`;
}
