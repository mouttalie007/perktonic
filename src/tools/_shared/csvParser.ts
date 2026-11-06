export type Delimiter = "," | ";" | "\t" | "|";
export const DELIMITERS: Delimiter[] = [",", ";", "\t", "|"];

const QUOTE = 34;
const LF = 10;
const CR = 13;

/**
 * Incremental RFC 4180 parser. Feed text in any chunk sizes with `push`;
 * only complete rows are returned, the unfinished tail is carried over, so
 * quoted fields with embedded newlines may span chunks.
 */
export class CsvStreamParser {
  private buffer = "";
  private readonly delim: number;
  unclosedQuote = false;

  constructor(delimiter: Delimiter) {
    this.delim = delimiter.charCodeAt(0);
  }

  push(chunk: string): string[][] {
    const text = this.buffer + chunk;
    const { rows, consumed } = this.parse(text, false);
    this.buffer = text.slice(consumed);
    return rows;
  }

  end(): string[][] {
    const text = this.buffer;
    this.buffer = "";
    if (text === "") return [];
    return this.parse(text, true).rows;
  }

  private parse(text: string, final: boolean): { rows: string[][]; consumed: number } {
    const rows: string[][] = [];
    const n = text.length;
    const delim = this.delim;
    let i = 0;
    let consumed = 0;

    rowLoop: while (i < n) {
      const row: string[] = [];
      for (;;) {
        let value: string;
        if (text.charCodeAt(i) === QUOTE) {
          let j = i + 1;
          value = "";
          for (;;) {
            const k = text.indexOf("\"", j);
            if (k === -1) {
              if (!final) break rowLoop;
              value += text.slice(j);
              this.unclosedQuote = true;
              i = n;
              break;
            }
            if (k + 1 >= n && !final) break rowLoop;
            if (text.charCodeAt(k + 1) === QUOTE) {
              value += text.slice(j, k + 1);
              j = k + 2;
              continue;
            }
            value += text.slice(j, k);
            i = k + 1;
            break;
          }
          // Lenient: characters between a closing quote and the delimiter are kept.
          let j2 = i;
          while (j2 < n) {
            const c = text.charCodeAt(j2);
            if (c === delim || c === LF || c === CR) break;
            j2++;
          }
          if (j2 > i) value += text.slice(i, j2);
          i = j2;
        } else {
          let j = i;
          while (j < n) {
            const c = text.charCodeAt(j);
            if (c === delim || c === LF || c === CR) break;
            j++;
          }
          value = text.slice(i, j);
          i = j;
        }
        row.push(value);

        if (i >= n) {
          if (!final) break rowLoop;
          rows.push(row);
          consumed = n;
          break rowLoop;
        }
        const c = text.charCodeAt(i);
        if (c === delim) {
          i++;
          if (i >= n) {
            if (!final) break rowLoop;
            row.push("");
            rows.push(row);
            consumed = n;
            break rowLoop;
          }
          continue;
        }
        if (c === CR) {
          if (i + 1 >= n && !final) break rowLoop;
          i += text.charCodeAt(i + 1) === LF ? 2 : 1;
        } else {
          i++;
        }
        rows.push(row);
        consumed = i;
        continue rowLoop;
      }
    }
    if (final) consumed = n;
    return { rows, consumed };
  }
}

export function parseCsv(text: string, delimiter: Delimiter): { rows: string[][]; unclosedQuote: boolean } {
  const p = new CsvStreamParser(delimiter);
  const rows = p.push(text);
  rows.push(...p.end());
  return { rows, unclosedQuote: p.unclosedQuote };
}

/**
 * Picks the delimiter that splits the sample into the most consistent column
 * count. Only complete lines of the sample are used.
 */
export function detectDelimiter(sample: string): Delimiter {
  const cut = sample.length > 65536 ? sample.slice(0, 65536) : sample;
  const lastBreak = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf("\r"));
  const text = lastBreak > 0 && cut.length === 65536 ? cut.slice(0, lastBreak) : cut;
  let best: Delimiter = ",";
  let bestScore = 0;
  for (const d of DELIMITERS) {
    const rows = parseCsv(text, d).rows.slice(0, 50).filter((r) => !(r.length === 1 && r[0] === ""));
    if (rows.length === 0) continue;
    const counts = new Map<number, number>();
    for (const r of rows) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
    let mode = 1;
    let freq = 0;
    for (const [len, f] of counts) {
      if (f > freq || (f === freq && len > mode)) {
        mode = len;
        freq = f;
      }
    }
    if (mode < 2) continue;
    const score = (freq / rows.length) * 1000 + mode;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}
