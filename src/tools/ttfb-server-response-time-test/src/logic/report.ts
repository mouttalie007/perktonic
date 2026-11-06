// Used by the page, so it must not import anything that reaches @/lib/tools.
import { RATING_LABEL, THRESHOLDS, THRESHOLD_SOURCE, type Result } from "./types";

/** Plain-text summary for the Copy button. */
export function reportText(r: Result): string {
  const lines = [`TTFB test: ${r.url}`, `Measured ${r.measuredAt} from ${r.location}`, ""];
  if (r.median) {
    const p = r.median;
    lines.push(`Median of ${r.runs.filter((x) => x.ok).length} runs: TTFB ${p.ttfbMs} ms (${r.rating ? RATING_LABEL[r.rating] : "not rated"}), total ${p.totalMs} ms`);
    lines.push(`  DNS ${p.dnsMs ?? "n/a"} ms · connect ${p.connectMs ?? "n/a"} ms · TLS ${p.tlsMs ?? "n/a"} ms · wait ${p.waitMs} ms · download ${p.downloadMs} ms`);
  }
  for (const x of r.runs) lines.push(x.ok ? `Run ${x.n}: HTTP ${x.status}, TTFB ${x.phases.ttfbMs} ms, total ${x.phases.totalMs} ms` : `Run ${x.n}: ${x.message}`);
  if (r.redirect) lines.push("", `The URL redirects (${r.redirect.status}) to ${r.redirect.location}; these times are for the redirect response only.`);
  lines.push("", `Thresholds (${THRESHOLD_SOURCE.url}): good ≤ ${THRESHOLDS.goodMs} ms, poor > ${THRESHOLDS.poorMs} ms.`);
  return lines.join("\n");
}

/** One row per run for the CSV download. */
export function runsCsv(r: Result): string {
  const head = "run,status,dns_ms,connect_ms,tls_ms,wait_ms,download_ms,ttfb_ms,total_ms,bytes,error";
  const rows = r.runs.map((x) =>
    x.ok
      ? [x.n, x.status, x.phases.dnsMs ?? "", x.phases.connectMs ?? "", x.phases.tlsMs ?? "", x.phases.waitMs, x.phases.downloadMs, x.phases.ttfbMs, x.phases.totalMs, x.bytes, ""].join(",")
      : [x.n, "", "", "", "", "", "", "", "", "", `"${x.message.replace(/"/g, '""')}"`].join(","),
  );
  return [head, ...rows].join("\r\n") + "\r\n";
}
