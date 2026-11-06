import { MAX_FILE_BYTES } from "./limits";

export type FileCheck = { ok: true } | { ok: false; error: string };

/** Size and magic-byte check before a file is read; `head` is its first bytes. */
export function checkFile(head: Uint8Array, size: number): FileCheck {
  if (size === 0) return { ok: false, error: "This file is empty." };
  if (size > MAX_FILE_BYTES) return { ok: false, error: `This file is ${(size / 1048576).toFixed(1)} MB; the limit is 50 MB.` };
  const starts = (sig: number[]) => sig.every((b, i) => head[i] === b);
  if (starts([0x50, 0x4b, 0x03, 0x04])) return { ok: false, error: "This is a ZIP or Office file, not JSON. Unzip it first." };
  if (starts([0x1f, 0x8b])) return { ok: false, error: "This is a gzip-compressed file. Decompress it first (it usually ends in .json.gz)." };
  if (starts([0x25, 0x50, 0x44, 0x46]) || starts([0x89, 0x50, 0x4e, 0x47]) || starts([0xff, 0xd8, 0xff])) return { ok: false, error: "This is a PDF or an image, not a JSON file." };
  const utf16 = starts([0xff, 0xfe]) || starts([0xfe, 0xff]);
  if (!utf16 && head.includes(0)) return { ok: false, error: "This file contains binary data, so it is not JSON text." };
  return { ok: true };
}

/** UTF-8 (BOM removed) or UTF-16 with a BOM; JSON files must be Unicode (RFC 8259). */
export function decodeJsonBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  return new TextDecoder("utf-8").decode(bytes);
}

export interface Located {
  message: string;
  line: number;
  column: number;
  /** The offending line with a caret under the column. */
  pointer: string;
}

export function pointerAt(text: string, line: number, column: number): string {
  const lines = text.split("\n");
  let src = (lines[line - 1] ?? "").replace(/\t/g, " ");
  let col = column;
  // Long minified lines are cut around the error so the caret stays visible.
  if (src.length > 80) {
    const start = Math.max(0, col - 40);
    src = (start > 0 ? "…" : "") + src.slice(start, start + 80) + (start + 80 < src.length ? "…" : "");
    col = col - start + (start > 0 ? 1 : 0);
  }
  return `${src}\n${" ".repeat(Math.max(0, col - 1))}^`;
}

function lineCol(text: string, index: number): { line: number; column: number } {
  let line = 1;
  let last = -1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      last = i;
    }
  }
  return { line, column: index - last };
}

const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

/**
 * Index of the first character that makes `text` invalid JSON, or -1. Chrome's
 * "Unexpected token" messages carry no position, so this scan finds it
 * instead. It keeps an explicit stack, so deep nesting cannot overflow.
 */
export function firstJsonErrorIndex(text: string): number {
  const stack: ("o" | "a")[] = [];
  let expect: "value" | "valueOrEnd" | "key" | "keyOrEnd" | "colon" | "commaOrEnd" = "value";
  let i = 0;
  const ws = () => {
    while (i < text.length && (text[i] === " " || text[i] === "\n" || text[i] === "\r" || text[i] === "\t")) i++;
  };
  const string = (): boolean => {
    i++;
    while (i < text.length) {
      const c = text.charCodeAt(i);
      if (c === 34) {
        i++;
        return true;
      }
      if (c < 0x20) return false;
      if (c === 92) {
        const e = text[i + 1];
        if (e === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) return false;
          i += 6;
        } else if (e !== undefined && "\"\\/bfnrt".includes(e)) i += 2;
        else return false;
      } else i++;
    }
    return false;
  };
  let done = false;
  const afterValue = () => {
    expect = "commaOrEnd";
    done = stack.length === 0;
  };
  for (;;) {
    ws();
    // Anything after the top-level value is an error.
    if (done) return i < text.length ? i : -1;
    if (i >= text.length) return i;
    const c = text[i];
    if (expect === "value" || expect === "valueOrEnd") {
      if (expect === "valueOrEnd" && c === "]") {
        stack.pop();
        i++;
        afterValue();
        continue;
      }
      if (c === "{") {
        stack.push("o");
        expect = "keyOrEnd";
        i++;
      } else if (c === "[") {
        stack.push("a");
        expect = "valueOrEnd";
        i++;
      } else if (c === "\"") {
        if (!string()) return i;
        afterValue();
      } else if (text.startsWith("true", i) || text.startsWith("null", i)) {
        i += 4;
        afterValue();
      } else if (text.startsWith("false", i)) {
        i += 5;
        afterValue();
      } else {
        NUMBER.lastIndex = i;
        const m = NUMBER.exec(text);
        if (!m) return i;
        i += m[0].length;
        afterValue();
      }
    } else if (expect === "key" || expect === "keyOrEnd") {
      if (expect === "keyOrEnd" && c === "}") {
        stack.pop();
        i++;
        afterValue();
        continue;
      }
      if (c !== "\"") return i;
      if (!string()) return i;
      expect = "colon";
    } else if (expect === "colon") {
      if (c !== ":") return i;
      i++;
      expect = "value";
    } else {
      const top = stack[stack.length - 1];
      if (c === ",") {
        i++;
        expect = top === "o" ? "key" : "value";
      } else if ((c === "}" && top === "o") || (c === "]" && top === "a")) {
        stack.pop();
        i++;
        afterValue();
      } else return i;
    }
  }
}

/** Turns the engine's JSON.parse message into a position, whichever browser wrote it. */
export function locateJsonError(text: string, message: string): Located {
  let pos: { line: number; column: number } | null = null;
  const lc = /line (\d+) column (\d+)/.exec(message);
  const at = /position (\d+)/.exec(message);
  if (lc) pos = { line: Number(lc[1]), column: Number(lc[2]) };
  else if (at) pos = lineCol(text, Number(at[1]));
  if (!pos) {
    const idx = firstJsonErrorIndex(text);
    pos = lineCol(text, idx < 0 ? 0 : idx);
  }
  const clean = message.replace(/^JSON\.parse: /, "").replace(/ in JSON at position \d+.*$/, "").replace(/ of the JSON data$/, "").replace(/, (\.\.\.)?"[\s\S]*"(\.\.\.)? is not valid JSON$/, "");
  // The hint looks at the character itself, because browsers word these errors differently.
  const lines = text.split("\n");
  const errAt = lines.slice(0, pos.line - 1).reduce((n, l) => n + l.length + 1, 0) + pos.column - 1;
  const ch = text[errAt] ?? "";
  const before = text.slice(0, errAt).trimEnd().slice(-1);
  const hint = ch === "'" ? " JSON needs double quotes around strings and keys." : (ch === "}" || ch === "]") && before === "," ? " JSON does not allow a trailing comma." : /[A-Za-z_$]/.test(ch) && (before === "{" || before === ",") ? " Keys need double quotes, for example {\"name\": 1}." : ch === "" ? " The JSON ends too early: something is not closed." : "";
  return { message: `${clean}.${hint}`.replace(/\.\./g, "."), line: pos.line, column: pos.column, pointer: pointerAt(text, pos.line, pos.column) };
}

export type Parsed = { ok: true; value: unknown } | { ok: false; error: Located };

export function parseJson(text: string): Parsed {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: locateJsonError(text, (e as Error).message) };
  }
}

export function describeValue(v: unknown): string {
  if (Array.isArray(v)) return `an array of ${v.length.toLocaleString("en-US")} item${v.length === 1 ? "" : "s"}`;
  if (v === null) return "null";
  if (typeof v === "object") {
    const n = Object.keys(v as object).length;
    return `an object with ${n.toLocaleString("en-US")} key${n === 1 ? "" : "s"}`;
  }
  return `a ${typeof v}`;
}
