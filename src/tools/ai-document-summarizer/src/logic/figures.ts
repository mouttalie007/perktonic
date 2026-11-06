// Every number, percentage, date and amount in the summary must also be in the source text.
// We compare digit strings after removing separators ("1,250.50" → "125050", "3,5 %" → "35").

export interface FigureCheck {
  /** The figure as written in the summary. */
  text: string;
  found: boolean;
}

/** Figures: digit groups with thousands/decimal separators, optional % or currency around them. */
const FIGURE = /(?:[$€£¥₹]\s?)?\d(?:[,.'’  ]?\d|[ ](?=\d{3}(?!\d)))*(?:\s?%|\s?(?:bn|million|billion|k|m)\b)?/gi;

export function figuresIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(FIGURE)) {
    const f = m[0].trim();
    if (!/\d/.test(f)) continue;
    // "p99 720 ms": a figure glued to a letter is not a thousands group; split it at the plain spaces.
    const before = text[(m.index ?? 0) - 1] ?? "";
    if (/[A-Za-z]/.test(before) && f.includes(" ")) out.push(...f.split(" ").filter((x) => /\d/.test(x)));
    else out.push(f);
  }
  return out;
}

const digitsOf = (s: string) => s.replace(/\D/g, "");
/**
 * "2.50" and "2.5" are the same figure: trailing zeros are dropped only after a decimal separator,
 * that is when the last group after "." or "," does not have exactly 3 digits (a thousands group).
 */
function decimalTrim(f: string): string | null {
  const core = f.replace(/\s?%$/, "").replace(/\s?[a-z]+$/i, "");
  const m = /[.,](\d+)$/.exec(core);
  if (!m || m[1].length === 3 || !m[1].endsWith("0")) return null;
  return digitsOf(core).replace(/0+$/, "");
}

/** All digit strings of the source (each figure, each run of digits inside it, and decimal variants). */
export function sourceDigits(source: string): Set<string> {
  const set = new Set<string>();
  for (const f of figuresIn(source)) {
    set.add(digitsOf(f));
    const t = decimalTrim(f);
    if (t) set.add(t);
    for (const run of f.match(/\d+/g) ?? []) set.add(run);
  }
  return set;
}

export function checkFigures(text: string, digits: Set<string>): FigureCheck[] {
  return figuresIn(text).map((f) => {
    const t = decimalTrim(f);
    return { text: f, found: digits.has(digitsOf(f)) || (t !== null && digits.has(t)) };
  });
}
