// Whitespace-insensitive matching between the model's quotes / owners and the pasted text.

export const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

export function containsCollapsed(haystack: string, needle: string, caseInsensitive = false): boolean {
  const n = collapse(needle);
  if (!n) return false;
  const h = collapse(haystack);
  return caseInsensitive ? h.toLowerCase().includes(n.toLowerCase()) : h.includes(n);
}

/** Start and end offsets of a quote in the original text, allowing any whitespace between words. */
export function findQuote(text: string, quote: string): [number, number] | null {
  const words = collapse(quote).split(" ").filter(Boolean);
  if (!words.length) return null;
  const re = new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"));
  const m = re.exec(text);
  return m ? [m.index, m.index + m[0].length] : null;
}
