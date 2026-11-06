import type { Analysis } from "./analyze";
import type { ChainResult } from "./chain";

export function reportText(r: ChainResult, a: Analysis): string {
  const lines = [`Redirect chain for ${r.startUrl}`, ""];
  for (const h of r.hops) {
    lines.push(`${h.index}. ${h.status} ${h.statusText}  ${h.url}  (${h.ms} ms)`);
    if (h.location) lines.push(`   → ${h.location}`);
  }
  if (r.stop) lines.push("", `Stopped: ${r.stop.message}`);
  lines.push("", `Redirects: ${r.redirectCount}, total time: ${r.totalMs} ms, final URL: ${r.finalUrl}`);
  if (a.recommendation) lines.push("", `Recommendation: ${a.recommendation}`);
  if (a.findings.length) {
    lines.push("", "Findings:");
    for (const f of a.findings) lines.push(`- [${f.severity}] ${f.message}`);
  }
  return lines.join("\n") + "\n";
}

const q = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function reportCsv(r: ChainResult): string {
  const rows = [["hop", "url", "status", "status_text", "type", "location", "ms", "ttfb_ms"].join(",")];
  for (const h of r.hops) rows.push([h.index, h.url, h.status, h.statusText, h.kind, h.location, h.ms, h.ttfbMs].map(q).join(","));
  return rows.join("\r\n") + "\r\n";
}
