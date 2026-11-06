import { collapse, findQuote } from "./text";

/** The clause reference is kept only when it is in the quote, or on the quote's line or the line above it. */
export function verifyClauseRef(clauseRef: string | null, quote: string, text: string): string | null {
  if (!clauseRef || !clauseRef.trim()) return null;
  const ref = collapse(clauseRef).toLowerCase();
  // "Clause 4.2" and "Section 4.2" are kept when "4.2" alone is written there.
  const core = ref.replace(/^(clause|section|article|art\.|§)\s*/i, "");
  const has = (s: string) => {
    const t = collapse(s).toLowerCase();
    return (ref !== core && t.includes(ref)) || (core.length > 0 && new RegExp(`(^|[\\s(§])${core.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\d]|[.,]\\d)`).test(t));
  };
  if (has(quote)) return clauseRef;
  const at = findQuote(text, quote);
  if (!at) return null;
  const lineStart = text.lastIndexOf("\n", at[0] - 1) + 1;
  const sameLine = text.slice(lineStart, at[0]);
  if (has(sameLine)) return clauseRef;
  const above = text.slice(0, lineStart).replace(/\s+$/, "");
  const prevLine = above.slice(above.lastIndexOf("\n") + 1);
  return has(prevLine) ? clauseRef : null;
}
