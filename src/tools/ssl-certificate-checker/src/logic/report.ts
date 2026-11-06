// Used by the page: must not import anything that reaches @/lib/tools.
import type { SslResult } from "./types";

export function reportText(r: SslResult): string {
  const lines = [`SSL certificate check: ${r.host}:${r.port}`, `${r.checkedAt}${r.ip ? ` · ${r.ip}` : ""}`, "", `Verdict: ${r.verdict.text}`, ""];
  for (const c of r.checks) lines.push(`[${c.level}] ${c.title}. ${c.detail}`);
  lines.push("", `Negotiated: ${r.protocol ?? "?"} · ${r.cipher ?? "?"}${r.alpn ? ` · ALPN ${r.alpn}` : ""}`);
  lines.push(`Protocol versions: ${r.versions.map((v) => `${v.version} ${v.accepted === null ? "untested" : v.accepted ? "accepted" : "refused"}`).join(", ")}`, "", "Chain:");
  for (const c of r.chain) lines.push(`  ${c.role}: ${c.subject} — issued by ${c.issuer}, valid ${c.validFrom.slice(0, 10)} to ${c.validTo.slice(0, 10)}`);
  return lines.join("\n");
}
