const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Makes a value safe as a file name on Windows, macOS and Linux:
 * no / \ : * ? " < > | or control characters, no trailing dots or spaces,
 * no reserved Windows names, at most 80 characters.
 */
export function sanitizeFileName(value: string): string {
  let s = value.normalize("NFC").replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "_").trim();
  s = s.replace(/[. ]+$/, "").replace(/^\.+/, "");
  if (s === "") return "_empty";
  if (RESERVED.test(s.split(".")[0])) s = `_${s}`;
  if ([...s].length > 80) s = [...s].slice(0, 80).join("");
  return s;
}

/** Gives each sanitised name a unique, case-insensitive spelling ("France", "france" → "france-2"). */
export class NameRegistry {
  private used = new Set<string>();
  take(base: string, ext: string): string {
    let name = `${base}${ext}`;
    for (let n = 2; this.used.has(name.toLowerCase()); n++) name = `${base}-${n}${ext}`;
    this.used.add(name.toLowerCase());
    return name;
  }
}

/** "orders 2026.csv" → "orders 2026" */
export function baseName(fileName: string): string {
  return sanitizeFileName(fileName.replace(/\.(csv|tsv|txt)$/i, "")) || "data";
}
