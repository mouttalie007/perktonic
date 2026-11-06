// Models sometimes return a quoted piece of the formula with HTML entities (&quot;, &lt;, &#39;…).
// We compare after un-escaping, and show the un-escaped text.

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function unescapeHtml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return NAMED[code.toLowerCase()] ?? m;
  });
}

/** The step's part as it appears in the formula: as given, or after un-escaping; null when neither matches. */
export function matchPart(part: string, formula: string): string | null {
  if (part.trim() === "") return null;
  if (formula.includes(part)) return part;
  const plain = unescapeHtml(part);
  return plain !== part && formula.includes(plain) ? plain : null;
}
