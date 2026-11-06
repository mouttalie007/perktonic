import type { Analysis } from "./analyze";
import type { FetchResult } from "./fetchHeaders";

export function reportText(r: FetchResult, a: Analysis): string {
  const lines = [`HTTP response headers for ${r.finalUrl}`, `Status ${r.status}, method ${r.method}${r.fallback ? ` (${r.fallback})` : ""}`, ""];
  lines.push(`Security grade: ${a.security.grade} (${a.security.score}/100)`);
  for (const c of a.security.checks) lines.push(`- ${c.header}: ${c.status} (${c.points}/${c.max})${c.notes.length ? ` - ${c.notes.join(" ")}` : ""}`);
  if (a.notes.length) {
    lines.push("", "Caching, compression, cookies and disclosure:");
    for (const n of a.notes) lines.push(`- [${n.level}] ${n.message}`);
  }
  lines.push("", "Headers:");
  for (const row of a.rows) lines.push(`${row.name}: ${row.value}`);
  return lines.join("\n") + "\n";
}

export function headersCsv(a: Analysis): string {
  const q = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return ["name,value", ...a.rows.map((r) => `${q(r.name)},${q(r.value)}`)].join("\r\n") + "\r\n";
}
