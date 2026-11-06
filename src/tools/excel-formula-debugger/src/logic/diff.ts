// Word-level diff for showing a corrected formula against the original.

export type DiffPart = { type: "same" | "add" | "del"; text: string };

function chunks(s: string): string[] {
  return s.match(/"(?:[^"]|"")*"?|'(?:[^']|'')*'?|[A-Za-z_$][\w.$]*|\d+(?:[.,]\d+)?|\s+|[\s\S]/g) ?? [];
}

export function diff(before: string, after: string): DiffPart[] {
  const a = chunks(before);
  const b = chunks(after);
  // Trim the common prefix and suffix first: most fixes touch one spot.
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const midA = a.slice(p, a.length - s);
  const midB = b.slice(p, b.length - s);
  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    if (!text) return;
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };
  push("same", a.slice(0, p).join(""));
  if (midA.length * midB.length > 250_000) {
    push("del", midA.join(""));
    push("add", midB.join(""));
  } else {
    // Longest common subsequence on the middle chunks.
    const n = midA.length;
    const m = midB.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = midA[i] === midB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        push("same", midA[i]);
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) push("del", midA[i++]);
      else push("add", midB[j++]);
    }
    while (i < n) push("del", midA[i++]);
    while (j < m) push("add", midB[j++]);
  }
  push("same", a.slice(a.length - s).join(""));
  return parts;
}
