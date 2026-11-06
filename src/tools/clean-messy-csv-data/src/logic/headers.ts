export type HeaderStyle = "trim" | "snake" | "title" | "lower";

// Built at runtime so TypeScript's ES2017 target does not reject the \p{…} escapes.
const NON_WORD_RE = new RegExp("[^\\p{L}\\p{N}]+", "gu");
const CAMEL_RE = new RegExp("(\\p{Ll})(\\p{Lu})", "gu");

function words(name: string): string[] {
  return name.replace(CAMEL_RE, "$1 $2").split(NON_WORD_RE).filter((w) => w !== "");
}

export function styleHeader(name: string, style: HeaderStyle): string {
  const base = name.trim().replace(/\s+/g, " ");
  switch (style) {
    case "trim":
      return base;
    case "lower":
      return base.toLowerCase();
    case "snake":
      return words(base).join("_").toLowerCase();
    case "title":
      return words(base)
        .map((w) => (w === w.toUpperCase() && w.length > 1 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join(" ");
  }
}

/** Applies the style, then fills blanks (column_N) and de-duplicates (_2, _3…). */
export function normalizeHeaders(raw: string[], style: HeaderStyle): string[] {
  const used = new Set<string>();
  return raw.map((name, i) => {
    let h = styleHeader(name, style);
    if (h === "") h = style === "title" ? `Column ${i + 1}` : `column_${i + 1}`;
    const key = (s: string) => s.toLowerCase();
    if (used.has(key(h))) {
      let n = 2;
      while (used.has(key(`${h}_${n}`))) n++;
      h = `${h}_${n}`;
    }
    used.add(key(h));
    return h;
  });
}
