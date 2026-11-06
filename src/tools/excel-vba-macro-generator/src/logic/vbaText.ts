// Reading VBA without running it: blank out comments and string contents, keeping every line's length,
// so a detector match on the code view maps to the same line and column in the original.

export interface VbaLine {
  /** 1-based line number in the pasted or generated code. */
  n: number;
  raw: string;
  /** Comments removed and string contents blanked (quotes kept). */
  code: string;
}

export function splitLines(src: string): string[] {
  return src.replace(/\r\n?/g, "\n").split("\n");
}

function blankLine(line: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inString) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          out += "  ";
          i++;
          continue;
        }
        inString = false;
        out += c;
      } else out += " ";
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    // A comment runs to the end of the line: ' anywhere, or Rem as a statement.
    if (c === "'" || (/^Rem(\s|$)/i.test(line.slice(i)) && /(^|:)\s*$/.test(line.slice(0, i)))) {
      out += " ".repeat(line.length - i);
      break;
    }
    out += c;
  }
  return out;
}

export function vbaLines(src: string): VbaLine[] {
  const lines = splitLines(src);
  const out: VbaLine[] = [];
  let continued = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // A comment continued with " _" stays a comment on the next line.
    const code: string = continued ? " ".repeat(raw.length) : blankLine(raw);
    continued = code.trim() === "" && /'.*\s_\s*$/.test(raw) ? true : continued && /\s_\s*$/.test(raw);
    out.push({ n: i + 1, raw, code });
  }
  return out;
}

/** The string literal that starts at `index` in a raw line (index of the opening quote). */
export function literalAt(raw: string, index: number): string | null {
  if (raw[index] !== '"') return null;
  let v = "";
  for (let i = index + 1; i < raw.length; i++) {
    if (raw[i] === '"') {
      if (raw[i + 1] === '"') {
        v += '"';
        i++;
        continue;
      }
      return v;
    }
    v += raw[i];
  }
  return v;
}

/** All string literals of a line, from the code view's quote positions. */
export function literalsOf(line: VbaLine): string[] {
  const out: string[] = [];
  let open = -1;
  for (let i = 0; i < line.code.length; i++) {
    if (line.code[i] !== '"') continue;
    if (open < 0) open = i;
    else {
      out.push(literalAt(line.raw, open) ?? "");
      open = -1;
    }
  }
  return out;
}
