// Used by the page: must not import anything that reaches @/lib/tools.
import type { Check, EmailAuthResult, Level, SpfNode } from "./types";

const ORDER: Level[] = ["error", "warning", "info", "good"];
export const worst = (checks: Check[]): Level => ORDER.find((l) => checks.some((c) => c.level === l)) ?? "info";

function tree(n: SpfNode, depth: number, out: string[]) {
  out.push(`${"  ".repeat(depth)}${depth ? `${n.via}: ` : ""}${n.domain}${n.lookups ? ` (${n.lookups} lookups)` : ""}${n.problem ? ` — ${n.problem}` : ""}`);
  for (const c of n.children) tree(c, depth + 1, out);
}

export function reportText(r: EmailAuthResult): string {
  const lines = [`Email authentication check: ${r.domain}`, `${r.checkedAt} · ${r.queries} DNS queries`, ""];
  const section = (title: string, record: string | null, checks: Check[], suggestion?: string | null) => {
    lines.push(`== ${title} ==`, record ? `Record: ${record}` : "Record: none");
    for (const c of checks) lines.push(`  [${c.level}] ${c.message}`);
    if (suggestion) lines.push(`  Suggested: ${suggestion}`);
    lines.push("");
  };
  section(`SPF (${r.spf.lookups}/10 lookups)`, r.spf.record, r.spf.checks, r.spf.suggestion);
  if (r.spf.tree) {
    const t: string[] = [];
    tree(r.spf.tree, 0, t);
    lines.push("SPF include tree:", ...t.map((x) => `  ${x}`), "");
  }
  section(`DMARC${r.dmarc.foundAt ? ` (${r.dmarc.foundAt})` : ""}`, r.dmarc.record, r.dmarc.checks, r.dmarc.suggestion);
  section(`DKIM (${r.dkim.mode === "probe" ? `${r.dkim.selectorsTried.length} common selectors tried` : `selector ${r.dkim.selectorsTried[0]}`})`, r.dkim.found.map((k) => `${k.selector}: ${k.record.slice(0, 60)}…`).join(" | ") || null, r.dkim.checks);
  section("MTA-STS", r.mtaSts.record, r.mtaSts.checks);
  section("BIMI", r.bimi.record, r.bimi.checks);
  lines.push("This checks DNS records only. It cannot tell whether a given message will be delivered.");
  return lines.join("\n");
}
