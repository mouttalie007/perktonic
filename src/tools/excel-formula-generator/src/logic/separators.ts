// Converting argument separators between English (",") and many European locales (";").
// Text in double quotes, quoted sheet names, table references and array constants are left alone.

type Segment = { code: boolean; text: string };

/** Split a formula into code and protected parts ("text", 'sheet names', [table refs], {arrays}). */
export function segments(src: string): Segment[] {
  const out: Segment[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ code: true, text: buf });
    buf = "";
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'") {
      flush();
      let j = i + 1;
      for (; j < src.length; j++) {
        if (src[j] === c) {
          if (src[j + 1] === c) {
            j++;
            continue;
          }
          break;
        }
      }
      out.push({ code: false, text: src.slice(i, j + 1) });
      i = j;
      continue;
    }
    if (c === "[" || c === "{") {
      flush();
      const close = c === "[" ? "]" : "}";
      let depth = 0;
      let j = i;
      for (; j < src.length; j++) {
        if (src[j] === '"') {
          const k = src.indexOf('"', j + 1);
          j = k < 0 ? src.length : k;
          continue;
        }
        if (src[j] === c) depth++;
        else if (src[j] === close && --depth === 0) break;
      }
      out.push({ code: false, text: src.slice(i, j + 1) });
      i = j;
      continue;
    }
    buf += c;
  }
  flush();
  return out;
}

/** "," → ";" and decimal points → decimal commas, e.g. =ROUND(A1*0.5, 2) → =ROUND(A1*0,5; 2). */
export function toSemicolons(src: string): string {
  if (separatorStyle(src) === "semicolon") return src;
  return segments(src)
    .map((s) => (s.code ? s.text.replace(/,/g, ";").replace(/(^|[^\w.$])(\d+)\.(\d+)/g, "$1$2,$3") : s.text))
    .join("");
}

/** ";" → "," and decimal commas → points, the reverse of toSemicolons. */
export function toCommas(src: string): string {
  const style = separatorStyle(src);
  if (style === "comma" || style === "none") return src;
  return segments(src)
    .map((s) => (s.code ? s.text.replace(/(^|[^\w.$])(\d+),(\d+)/g, "$1$2.$3").replace(/;/g, ",") : s.text))
    .join("");
}

/** Which argument separators the code parts use. */
export function separatorStyle(src: string): "comma" | "semicolon" | "mixed" | "none" {
  const code = segments(src)
    .filter((s) => s.code)
    .map((s) => s.text)
    .join(" ");
  const semis = (code.match(/;/g) ?? []).length;
  // A comma between two digits in a semicolon formula is a decimal comma, not a separator.
  const commas = (code.match(/,/g) ?? []).length - (semis ? (code.match(/\d,\d/g) ?? []).length : 0);
  if (semis && commas > 0) return "mixed";
  if (semis) return "semicolon";
  if (commas) return "comma";
  return "none";
}
