export class ShellError extends Error {}

export interface ShellResult {
  words: string[];
  /** Things the tokenizer saw but cannot turn into one request ($VAR, $(…)). */
  warnings: string[];
}

const ANSI_ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", a: "\x07", b: "\b", e: "\x1b", E: "\x1b", f: "\f", v: "\v", "\\": "\\", "'": "'", "\"": "\"", "?": "?" };

/**
 * Splits a POSIX shell command into words the way bash would for a single
 * simple command: single quotes, double quotes (with \" \\ \$ \` escapes),
 * $'…' ANSI-C quoting, backslash escapes and backslash-newline continuations.
 * Nothing is ever executed or expanded; $VAR is kept literally with a warning.
 */
export function splitShell(input: string): ShellResult {
  // Chrome's "Copy as cURL (cmd)" uses ^ for escapes and line continuations.
  const src = /\^\r?\n/.test(input) ? input.replace(/\^\r?\n/g, " ").replace(/\^(.)/g, "$1") : input;
  const words: string[] = [];
  const warnings = new Set<string>();
  let cur = "";
  let inWord = false;
  let i = 0;
  const n = src.length;
  const push = () => {
    if (inWord) words.push(cur);
    cur = "";
    inWord = false;
  };
  while (i < n) {
    const c = src[i];
    if (c === "\\" && (src[i + 1] === "\n" || (src[i + 1] === "\r" && src[i + 2] === "\n"))) {
      i += src[i + 1] === "\r" ? 3 : 2;
      continue;
    }
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      push();
      i++;
      continue;
    }
    if (c === "#" && !inWord) {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "|" || c === ";" || c === "&" || c === ">" || c === "<") {
      throw new ShellError(`The command contains “${c}”. Paste a single curl command without pipes, redirects or chained commands.`);
    }
    if (c === "`" || (c === "$" && src[i + 1] === "(")) throw new ShellError("Command substitution ($(…) or `…`) cannot be converted. Replace it with its value.");
    inWord = true;
    if (c === "'") {
      const end = src.indexOf("'", i + 1);
      if (end < 0) throw new ShellError("A single quote (') is not closed.");
      cur += src.slice(i + 1, end);
      i = end + 1;
      continue;
    }
    if (c === "$" && src[i + 1] === "'") {
      i += 2;
      for (;;) {
        if (i >= n) throw new ShellError("A $'…' string is not closed.");
        const ch = src[i];
        if (ch === "'") {
          i++;
          break;
        }
        if (ch === "\\") {
          const e = src[i + 1];
          if (e in ANSI_ESCAPES) {
            cur += ANSI_ESCAPES[e];
            i += 2;
          } else if (e === "x") {
            const hex = /^[0-9a-fA-F]{1,2}/.exec(src.slice(i + 2))?.[0] ?? "";
            cur += hex ? String.fromCharCode(parseInt(hex, 16)) : "\\x";
            i += 2 + hex.length;
          } else if (e === "u" || e === "U") {
            const hex = new RegExp(`^[0-9a-fA-F]{1,${e === "u" ? 4 : 8}}`).exec(src.slice(i + 2))?.[0] ?? "";
            cur += hex ? String.fromCodePoint(parseInt(hex, 16)) : `\\${e}`;
            i += 2 + hex.length;
          } else if (/[0-7]/.test(e ?? "")) {
            const oct = /^[0-7]{1,3}/.exec(src.slice(i + 1))![0];
            cur += String.fromCharCode(parseInt(oct, 8));
            i += 1 + oct.length;
          } else {
            cur += "\\" + (e ?? "");
            i += 2;
          }
          continue;
        }
        cur += ch;
        i++;
      }
      continue;
    }
    if (c === "\"") {
      i++;
      for (;;) {
        if (i >= n) throw new ShellError("A double quote (\") is not closed.");
        const ch = src[i];
        if (ch === "\"") {
          i++;
          break;
        }
        if (ch === "\\" && "\"\\$`\n".includes(src[i + 1] ?? "")) {
          if (src[i + 1] !== "\n") cur += src[i + 1];
          i += 2;
          continue;
        }
        if (ch === "$" && /[A-Za-z_{]/.test(src[i + 1] ?? "")) warnings.add("Shell variables such as $TOKEN are kept as literal text; replace them with real values.");
        if (ch === "$" && src[i + 1] === "(") throw new ShellError("Command substitution ($(…)) cannot be converted. Replace it with its value.");
        cur += ch;
        i++;
      }
      continue;
    }
    if (c === "\\") {
      cur += src[i + 1] ?? "";
      i += 2;
      continue;
    }
    if (c === "$" && /[A-Za-z_{]/.test(src[i + 1] ?? "")) warnings.add("Shell variables such as $TOKEN are kept as literal text; replace them with real values.");
    cur += c;
    i++;
  }
  push();
  return { words, warnings: [...warnings] };
}

/** Quotes a word for bash: plain when safe, '…' otherwise, $'…' when it contains control characters. */
export function shellQuote(word: string): string {
  if (word !== "" && /^[A-Za-z0-9_@%+=:,./-]+$/.test(word)) return word;
  if (/[\x00-\x08\x0b-\x1f\x7f]/.test(word) || word.includes("\n")) {
    const esc = word.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, (ch) => `\\x${ch.charCodeAt(0).toString(16).padStart(2, "0")}`);
    return `$'${esc}'`;
  }
  return `'${word.replace(/'/g, "'\\''")}'`;
}
