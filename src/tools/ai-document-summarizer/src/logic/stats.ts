// Lengths and reduction, computed by us (never by the model).

export function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  // Words for alphabetic scripts; for Chinese and Japanese, count characters as words.
  const cjk = (t.match(/[぀-ヿ㐀-鿿]/g) ?? []).length;
  return t.replace(/[぀-ヿ㐀-鿿]/g, " ").split(/\s+/).filter(Boolean).length + cjk;
}

export function reduction(originalWords: number, summaryWords: number): number {
  if (originalWords <= 0) return 0;
  return Math.max(0, Math.round((1 - summaryWords / originalWords) * 100));
}
