// Things in the spreadsheet logic that have no exact SQL / pandas equivalent, found by our own code.

export function sourceWarnings(source: string): string[] {
  const s = source.replace(/"(?:[^"]|"")*"/g, '""');
  const out: string[] = [];
  const volatile = [...new Set([...s.matchAll(/\b(TODAY|NOW|RAND|RANDBETWEEN|RANDARRAY|OFFSET|INDIRECT)\s*\(/gi)].map((m) => m[1].toUpperCase()))];
  if (volatile.length) out.push(`${volatile.join(", ")} ${volatile.length === 1 ? "is" : "are"} volatile in a spreadsheet (recalculated all the time). In SQL or pandas the value is fixed when the query runs; OFFSET and INDIRECT have no direct equivalent at all.`);
  for (const m of s.matchAll(/\b(VLOOKUP|HLOOKUP)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi)) {
    const args = m[2].split(",");
    const last = args[3]?.trim().toUpperCase();
    if (args.length === 3 || last === "TRUE" || last === "1") {
      out.push(`${m[1].toUpperCase()} in approximate-match mode finds the closest smaller value in a sorted list. A JOIN matches exact values only; the closest-lower match needs a different query (for example a correlated subquery with MAX, or pandas merge_asof).`);
      break;
    }
  }
  if (/\b(MATCH|XMATCH)\s*\([^)]*,\s*(1|-1)\s*\)/i.test(s)) out.push("MATCH with match type 1 or -1 is an approximate match on sorted data; SQL joins and pandas merges match exact values.");
  if (/^\s*\{=/.test(source) || /\b(FILTER|UNIQUE|SORT|SORTBY|SEQUENCE|LAMBDA|MAP|BYROW)\s*\(/i.test(s)) out.push("Array and dynamic-array formulas return several values at once; the converted code returns a result set or a column instead of spilling into cells.");
  if (/\b(SUMPRODUCT)\s*\(/i.test(s)) out.push("SUMPRODUCT treats TRUE/FALSE as 1/0; in SQL this becomes SUM(CASE WHEN … THEN … ELSE 0 END) and in pandas a boolean mask.");
  return out;
}
