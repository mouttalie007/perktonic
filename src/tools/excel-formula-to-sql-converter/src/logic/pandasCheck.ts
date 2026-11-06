// Pandas code has no checker in v1: we list the import lines and check brackets, outside strings and comments.

export interface PandasCheck {
  imports: string[];
  balanced: boolean;
  message: string | null;
}

export function checkPandas(code: string): PandasCheck {
  const imports = code
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^(import\s+\w|from\s+[\w.]+\s+import\s)/.test(l));
  const stack: { c: string; line: number }[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  let line = 1;
  let message: string | null = null;
  for (let i = 0; i < code.length && !message; i++) {
    const c = code[i];
    if (c === "\n") {
      line++;
      continue;
    }
    if (c === "#") {
      while (i < code.length && code[i] !== "\n") i++;
      i--;
      continue;
    }
    if (c === '"' || c === "'") {
      const triple = code.slice(i, i + 3) === c.repeat(3);
      const end = triple ? c.repeat(3) : c;
      let j = i + end.length;
      for (; j < code.length; j++) {
        if (code[j] === "\\") {
          j++;
          continue;
        }
        if (code[j] === "\n") {
          if (!triple) break;
          line++;
        }
        if (code.slice(j, j + end.length) === end) break;
      }
      if (j >= code.length || (!triple && code[j] === "\n")) message = `A string that starts on line ${line} is never closed.`;
      i = j + end.length - 1;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") stack.push({ c, line });
    else if (c in pairs) {
      const top = stack.pop();
      if (!top || top.c !== pairs[c]) message = `Unexpected "${c}" on line ${line}.`;
    }
  }
  if (!message && stack.length) message = `"${stack[stack.length - 1].c}" opened on line ${stack[stack.length - 1].line} is never closed.`;
  return { imports, balanced: message === null, message };
}
