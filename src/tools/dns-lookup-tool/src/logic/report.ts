// Used by the page: must not import anything that reaches @/lib/tools.
import type { LookupResult } from "./types";

export function recordsCsv(r: LookupResult): string {
  const q = (v: string) => (/[",\r\n]/.test(v) || /^[=+\-@]/.test(v) ? `"${(/^[=+\-@]/.test(v) ? "'" : "") + v.replace(/"/g, '""')}"` : v);
  const rows = ["type,name,ttl,value"];
  for (const c of r.chain) rows.push(["CNAME", c.name, String(c.ttl), c.data].map(q).join(","));
  for (const t of r.results) if (!(t.type === "CNAME" && r.chain.length)) for (const rec of t.records) rows.push([t.type, rec.name, String(rec.ttl), rec.data].map(q).join(","));
  return rows.join("\r\n") + "\r\n";
}

export function reportText(r: LookupResult): string {
  const lines = [`DNS lookup: ${r.domain}${r.unicode ? ` (${r.unicode})` : ""}`, `Resolver: ${r.resolver} · ${r.checkedAt}`, ""];
  if (r.chain.length) lines.push(`CNAME chain: ${[r.domain, ...r.chain.map((c) => c.data)].join(" → ")}`, "");
  for (const t of r.results) {
    if (t.type === "CNAME" && r.chain.length) continue;
    lines.push(`${t.type}: ${t.records.length ? "" : t.status === "nodata" ? "none" : t.status}`);
    for (const rec of t.records) lines.push(`  ${rec.data}   (TTL ${rec.ttl})`);
  }
  lines.push("", "Findings:");
  for (const f of r.findings) lines.push(`  [${f.level}] ${f.message}`);
  const g = r.registration;
  if (g) {
    lines.push("", "Registration (RDAP):");
    if (g.status === "ok") lines.push(`  Registrar: ${g.registrar ?? "n/a"}`, `  Created: ${g.created ?? "n/a"}`, `  Expires: ${g.expires ?? "n/a"}`, `  Name servers: ${g.nameservers.join(", ")}`);
    else lines.push(`  ${g.message}`);
  }
  return lines.join("\n");
}
