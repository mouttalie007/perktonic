export type Delimiter = "," | ";" | "\t" | "|";

export const DELIMITERS: Delimiter[] = [",", ";", "\t", "|"];

export interface ParseResult {
  rows: string[][];
  delimiter: Delimiter;
  /** True when the text ended inside an open quoted field. */
  unclosedQuote: boolean;
}

/**
 * RFC 4180 parser that also accepts the quirks of spreadsheet clipboards:
 * CR, LF or CRLF line endings, quoted fields with embedded newlines and
 * doubled quotes, and stray quotes inside unquoted fields (kept literally).
 */
export function parseDelimited(text: string, delimiter: Delimiter): Omit<ParseResult, "delimiter"> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === "\"") {
        if (text[i + 1] === "\"") {
          field += "\"";
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === "\"" && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      fieldStarted = false;
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      fieldStarted = false;
      i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    field += ch;
    fieldStarted = true;
    i += 1;
  }
  if (fieldStarted || field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return { rows, unclosedQuote: inQuotes };
}

/**
 * Picks the delimiter that splits the first lines into the most consistent
 * number of columns. Tabs win outright when present, because clipboard data
 * from Excel and Google Sheets is always tab separated.
 */
export function detectDelimiter(text: string): Delimiter {
  const sample = text.slice(0, 64 * 1024);
  const firstLine = sample.split(/\r\n|\n|\r/, 1)[0] ?? "";
  if (firstLine.includes("\t")) return "\t";

  let best: Delimiter = ",";
  let bestScore = 0;
  for (const d of DELIMITERS) {
    const { rows } = parseDelimited(sample, d);
    const lines = rows.slice(0, 50).filter((r) => !(r.length === 1 && r[0] === ""));
    if (lines.length === 0) continue;
    const counts = new Map<number, number>();
    for (const r of lines) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
    let mode = 1;
    let modeFreq = 0;
    for (const [len, freq] of counts) {
      if (freq > modeFreq || (freq === modeFreq && len > mode)) {
        mode = len;
        modeFreq = freq;
      }
    }
    if (mode < 2) continue;
    const score = (modeFreq / lines.length) * 1000 + mode;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export function parseAuto(text: string, delimiter: Delimiter | "auto" = "auto"): ParseResult {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const d = delimiter === "auto" ? detectDelimiter(clean) : delimiter;
  const { rows, unclosedQuote } = parseDelimited(clean, d);
  // A trailing newline in pasted data produces one empty row; drop it.
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c === "")) rows.pop();
  return { rows, delimiter: d, unclosedQuote };
}
