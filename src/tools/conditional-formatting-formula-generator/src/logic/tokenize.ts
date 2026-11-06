// Tokenizer for Excel / Google Sheets / LibreOffice (Excel syntax) formulas.
// Every token keeps its start and end offset in the original text, so a failure
// can point at the exact character and the explanation can quote the source.

export type TokenType =
  | "func" // NAME( : value is the function name without the "(" (prefixes such as _xlfn. removed)
  | "open" // (
  | "close" // )
  | "sep" // argument separator: , or ;
  | "op" // + - * / ^ & = <> < > <= >= % : @ and " " (intersection)
  | "number"
  | "string" // value is the unescaped text
  | "bool"
  | "error" // #N/A, #REF! ...
  | "ref" // A1, $A$1:B2, A:A, 1:1, Sheet1!A1, 'My Sheet'!A1:B2, A1#
  | "name" // named range, LET variable or LAMBDA parameter
  | "struct" // structured reference: Table1[Col], [@Col], Table1[[#Headers],[A]:[B]]
  | "arrayOpen" // {
  | "arrayClose" // }
  | "arrayCol" // , or \ inside { }
  | "arrayRow"; // ; or | inside { }

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

export class FormulaSyntaxError extends Error {
  constructor(
    message: string,
    readonly pos: number,
  ) {
    super(message);
    this.name = "FormulaSyntaxError";
  }
}

export const ERROR_LITERALS = ["#NULL!", "#DIV/0!", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "#N/A", "#GETTING_DATA", "#SPILL!", "#CALC!", "#FIELD!", "#BLOCKED!", "#UNKNOWN!", "#BUSY!", "#CONNECT!", "#ERROR!"];

const SMART_QUOTES = /[“”„‟″‘’‚‛]/;

const CELL = String.raw`\$?[A-Za-z]{1,3}\$?[0-9]{1,7}`;
const COL = String.raw`\$?[A-Za-z]{1,3}`;
const ROW = String.raw`\$?[0-9]{1,7}`;
// A cell, a cell range, a column range or a row range, then an optional spill "#".
const AREA = new RegExp(String.raw`^(?:${CELL}(?::${CELL})?|${COL}:${COL}|${ROW}:${ROW}|${CELL}:${COL}|${CELL}:${ROW})#?`);
const SHEET_PLAIN = /^(?:\[[^\]]+\])?[A-Za-z_À-￿][\w.À-￿]*(?::[A-Za-z_À-￿][\w.À-￿]*)?!/;
const IDENT = /^[A-Za-z_\\À-￿][\w.\\?À-￿]*/;
const NUMBER = /^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?/;
const NUMBER_DECIMAL_COMMA = /^[0-9]+(?:,[0-9]+)?(?:[eE][+-]?[0-9]+)?/;

/** Column letters to a 1-based number (XFD = 16384 is the last Excel column). */
export function columnNumber(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function validArea(text: string): boolean {
  const parts = text.replace(/#$/, "").replace(/\$/g, "").split(":");
  for (const p of parts) {
    const m = /^([A-Za-z]{1,3})?([0-9]{1,7})?$/.exec(p);
    if (!m) return false;
    if (m[1] && columnNumber(m[1]) > 16384) return false;
    if (m[2] && (Number(m[2]) < 1 || Number(m[2]) > 1048576)) return false;
  }
  return true;
}

/** Which character separates arguments: semicolons are used by many European locales. */
export function detectSeparator(src: string): "," | ";" {
  let commas = 0;
  let semis = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'") {
      const close = src.indexOf(c, i + 1);
      if (close < 0) break;
      i = close;
      // a doubled quote is an escaped quote: keep skipping
      while (src[i + 1] === c) {
        const next = src.indexOf(c, i + 2);
        if (next < 0) return semis > commas ? ";" : ",";
        i = next;
      }
      continue;
    }
    if (c === "{") depthBrace++;
    else if (c === "}") depthBrace = Math.max(0, depthBrace - 1);
    else if (c === "[") depthBracket++;
    else if (c === "]") depthBracket = Math.max(0, depthBracket - 1);
    else if (depthBrace === 0 && depthBracket === 0) {
      if (c === ",") commas++;
      else if (c === ";") semis++;
    }
  }
  return semis > 0 && commas === 0 ? ";" : semis > commas ? ";" : ",";
}

export interface TokenizeOptions {
  /** Argument separator; detected from the text when omitted. */
  separator?: "," | ";";
}

export function tokenize(input: string, opts: TokenizeOptions = {}): Token[] {
  // A legacy Ctrl+Shift+Enter formula copied as {=...}: blank out the outer braces, keeping positions.
  const cse = /^(\s*)\{=([\s\S]*)\}(\s*)$/.exec(input);
  const src = cse ? `${cse[1]} =${cse[2]} ${cse[3]}` : input;
  const sep = opts.separator ?? detectSeparator(src);
  const out: Token[] = [];
  let i = 0;
  // Skip one leading "=" (or "+", which old Lotus-style entries use).
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] === "=" || src[i] === "+") i++;
  let braceDepth = 0;

  const push = (type: TokenType, value: string, start: number, end: number) => out.push({ type, value, start, end });
  const lastSignificant = () => out[out.length - 1];

  while (i < src.length) {
    const c = src[i];
    const rest = src.slice(i);

    if (/\s/.test(c)) {
      const start = i;
      while (i < src.length && /\s/.test(src[i])) i++;
      // A space between two references is Excel's intersection operator.
      const prev = lastSignificant();
      const next = src.slice(i);
      if (braceDepth === 0 && prev && (prev.type === "ref" || prev.type === "name" || prev.type === "close") && /^(?:\$?[A-Za-z]{1,3}\$?[0-9]|'|[A-Za-z_][\w.]*!)/.test(next) && !/^(?:[A-Za-z_][\w.]*\()/.test(next)) {
        push("op", " ", start, i);
      }
      continue;
    }

    if (SMART_QUOTES.test(c)) throw new FormulaSyntaxError(`Curly quote (${c}) at position ${i + 1}: spreadsheets only accept straight quotes (" and ').`, i);

    if (c === '"') {
      const start = i;
      let value = "";
      i++;
      for (;;) {
        if (i >= src.length) throw new FormulaSyntaxError(`Text that starts at position ${start + 1} is never closed with a ".`, start);
        if (src[i] === '"') {
          if (src[i + 1] === '"') {
            value += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        value += src[i++];
      }
      push("string", value, start, i);
      continue;
    }

    if (c === "#") {
      const err = ERROR_LITERALS.find((e) => rest.toUpperCase().startsWith(e));
      if (!err) throw new FormulaSyntaxError(`Unknown error value at position ${i + 1}.`, i);
      push("error", err, i, i + err.length);
      i += err.length;
      continue;
    }

    if (c === "{") {
      braceDepth++;
      push("arrayOpen", c, i, ++i);
      continue;
    }
    if (c === "}") {
      if (braceDepth === 0) throw new FormulaSyntaxError(`Closing brace "}" at position ${i + 1} has no opening "{".`, i);
      braceDepth--;
      push("arrayClose", c, i, ++i);
      continue;
    }
    if (braceDepth > 0 && (c === "," || c === "\\")) {
      push("arrayCol", c, i, ++i);
      continue;
    }
    if (braceDepth > 0 && (c === ";" || c === "|")) {
      push("arrayRow", c, i, ++i);
      continue;
    }
    if (c === "(") {
      push("open", c, i, ++i);
      continue;
    }
    if (c === ")") {
      push("close", c, i, ++i);
      continue;
    }
    if (c === sep) {
      push("sep", c, i, ++i);
      continue;
    }
    if (c === "," || c === ";") {
      const other = sep === "," ? "commas" : "semicolons";
      throw new FormulaSyntaxError(`${c === ";" ? "Semicolon" : "Comma"} at position ${i + 1} in a formula that separates arguments with ${other}.`, i);
    }

    // Two-character comparison operators first.
    const two = rest.slice(0, 2);
    if (two === "<>" || two === "<=" || two === ">=") {
      push("op", two, i, i + 2);
      i += 2;
      continue;
    }
    if ("+-*/^&=<>%@:".includes(c)) {
      push("op", c, i, ++i);
      continue;
    }

    // Quoted sheet name: 'My Sheet'!A1 or '[Book.xlsx]Sheet 1'!A1:B2
    if (c === "'") {
      const start = i;
      i++;
      for (;;) {
        if (i >= src.length) throw new FormulaSyntaxError(`Sheet name that starts at position ${start + 1} is never closed with a '.`, start);
        if (src[i] === "'") {
          if (src[i + 1] === "'") {
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      if (src[i] !== "!") throw new FormulaSyntaxError(`A quoted sheet name must be followed by "!" (position ${i + 1}).`, i);
      i++;
      const area = AREA.exec(src.slice(i));
      if (area && validArea(area[0])) {
        i += area[0].length;
        push("ref", src.slice(start, i), start, i);
        continue;
      }
      if (src.slice(i).toUpperCase().startsWith("#REF!")) {
        i += 5;
        push("ref", src.slice(start, i), start, i);
        continue;
      }
      const id = IDENT.exec(src.slice(i));
      if (id) {
        i += id[0].length;
        push("name", src.slice(start, i), start, i);
        continue;
      }
      throw new FormulaSyntaxError(`Expected a cell or range after the sheet name at position ${i + 1}.`, i);
    }

    // Structured reference that starts with "[" (inside a table: [@Col], [[#This Row],[Col]]).
    if (c === "[") {
      const start = i;
      i = skipBrackets(src, i);
      push("struct", src.slice(start, i), start, i);
      continue;
    }

    // Numbers (and row ranges such as 1:1, which also start with a digit).
    if (/[0-9.]/.test(c)) {
      const area = /^\$?[0-9]{1,7}:\$?[0-9]{1,7}(?![\w.(])/.exec(rest);
      if (area && validArea(area[0])) {
        push("ref", area[0], i, i + area[0].length);
        i += area[0].length;
        continue;
      }
      const point = NUMBER.exec(rest);
      const comma = sep === ";" ? NUMBER_DECIMAL_COMMA.exec(rest) : null;
      const m = comma && (!point || comma[0].length > point[0].length) ? comma : point;
      if (!m) throw new FormulaSyntaxError(`Unexpected "${c}" at position ${i + 1}.`, i);
      push("number", m[0], i, i + m[0].length);
      i += m[0].length;
      continue;
    }

    if (c === "$" || /[A-Za-z_\\À-￿]/.test(c)) {
      const start = i;
      // Sheet prefix without quotes: Sheet1!A1, [Book.xlsx]Data!A1, Jan:Mar!B2
      const sheet = SHEET_PLAIN.exec(rest);
      let afterSheet = rest;
      if (sheet) {
        afterSheet = rest.slice(sheet[0].length);
        if (afterSheet.toUpperCase().startsWith("#REF!")) {
          i += sheet[0].length + 5;
          push("ref", src.slice(start, i), start, i);
          continue;
        }
      }
      const area = AREA.exec(afterSheet);
      const areaEnd = area ? (sheet ? sheet[0].length : 0) + area[0].length : 0;
      if (area && validArea(area[0]) && !/^[\w.(\[]/.test(rest.slice(areaEnd))) {
        i += areaEnd;
        push("ref", src.slice(start, i), start, i);
        continue;
      }
      if (c === "$") throw new FormulaSyntaxError(`"$" at position ${i + 1} is not part of a valid cell reference.`, i);
      const id = IDENT.exec(sheet ? afterSheet : rest);
      if (!id) throw new FormulaSyntaxError(`Unexpected "${c}" at position ${i + 1}.`, i);
      i += (sheet ? sheet[0].length : 0) + id[0].length;
      const word = src.slice(start, i);
      if (src[i] === "(" && !sheet) {
        push("func", word.replace(/^(?:_xlfn\.|_xlws\.|_xludf\.|com\.microsoft\.)/i, "").toUpperCase(), start, i);
        push("open", "(", i, ++i);
        continue;
      }
      if (src[i] === "[" && !sheet) {
        i = skipBrackets(src, i);
        push("struct", src.slice(start, i), start, i);
        continue;
      }
      if (!sheet && /^(TRUE|FALSE)$/i.test(word)) {
        push("bool", word.toUpperCase(), start, i);
        continue;
      }
      push("name", word, start, i);
      continue;
    }

    throw new FormulaSyntaxError(`Unexpected "${c}" at position ${i + 1}.`, i);
  }
  if (braceDepth > 0) throw new FormulaSyntaxError(`An array constant "{" is never closed.`, src.lastIndexOf("{"));
  return out;
}

/** Skip a balanced [...] group (structured references nest one level and escape with '). */
function skipBrackets(src: string, i: number): number {
  const start = i;
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "'") {
      i++;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  throw new FormulaSyntaxError(`Table reference that starts at position ${start + 1} is never closed with "]".`, start);
}
