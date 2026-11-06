// Used by the page: must not import anything that reaches @/lib/tools.
import type { CrawlResult, Item } from "./types";

const q = (v: string) => {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function crawlCsv(r: CrawlResult): string {
  const rows = ["problem,url,status,detail,redirect_to,source_page,anchor_text"];
  const add = (label: string, items: Item[]) => {
    for (const i of items) for (const s of i.sources.length ? i.sources : [{ page: "", text: "" }]) rows.push([label, i.url, i.status === null ? "" : String(i.status), i.error ?? "", i.redirectTo ?? "", s.page, s.text].map(q).join(","));
  };
  add("broken link", r.broken);
  add("missing image", r.missingImages);
  add("redirect", r.redirects);
  add("could not check", r.unknown);
  return rows.join("\r\n") + "\r\n";
}

export function summaryText(r: CrawlResult): string {
  const lines = [
    `Broken link check: ${r.start}`,
    `${r.pagesCrawled} pages crawled, ${r.linksChecked} URLs checked in ${(r.durationMs / 1000).toFixed(1)} s${r.stoppedEarly ? ` (stopped early: ${r.stoppedEarly === "time" ? "90-second limit" : r.stoppedEarly === "links" ? "300-link limit" : "cancelled"})` : ""}`,
    `${r.broken.length} broken, ${r.missingImages.length} missing images, ${r.redirects.length} redirects`,
    "",
  ];
  for (const i of [...r.broken, ...r.missingImages]) lines.push(`${i.status ?? i.error}  ${i.url}  (on ${i.sources[0]?.page ?? "?"}${i.sources[0]?.text ? `, “${i.sources[0].text}”` : ""})`);
  for (const i of r.redirects) lines.push(`${i.status} → ${i.redirectTo}  ${i.url}`);
  return lines.join("\n");
}
