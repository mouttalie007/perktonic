import type { Figure, SummaryResult } from "../types";
import { figuresIn } from "./figures";

export type Part = { text: string; missing: boolean };

/** Split a text so that figures not found in the source can be marked in the page. */
export function markFigures(text: string, figures: Figure[]): Part[] {
  const missing = new Set(figures.filter((f) => !f.found).map((f) => f.text));
  if (!missing.size) return [{ text, missing: false }];
  const parts: Part[] = [];
  let rest = text;
  for (const f of figuresIn(text)) {
    if (!missing.has(f)) continue;
    const i = rest.indexOf(f);
    if (i < 0) continue;
    if (i > 0) parts.push({ text: rest.slice(0, i), missing: false });
    parts.push({ text: f, missing: true });
    rest = rest.slice(i + f.length);
  }
  if (rest) parts.push({ text: rest, missing: false });
  return parts;
}

type Ok = Extract<SummaryResult, { status: "ok" }>;
const flag = (figs: Figure[]) => (figs.some((f) => !f.found) ? ` (check: ${figs.filter((f) => !f.found).map((f) => f.text).join(", ")} not found in the text)` : "");

export function toMarkdown(r: Ok): string {
  const out = ["# Summary", "", r.summary + flag(r.summaryFigures), "", "## Key points", ""];
  for (const k of r.keyPoints) out.push(`- ${k.text}${flag(k.figures)}${k.verified ? "" : " (quote not verified)"}`, `  > ${k.quote.replace(/\s+/g, " ")}`);
  if (r.sections.length) {
    out.push("", "## Section by section", "");
    for (const s of r.sections) out.push(`### ${s.heading}`, "", s.summary + flag(s.figures), "");
  }
  out.push("", `Original: ${r.stats.originalWords} words. Summary: ${r.stats.summaryWords} words (${r.stats.reductionPercent}% shorter).`);
  return out.join("\n") + "\n";
}

export function toPlainText(r: Ok): string {
  const out = ["SUMMARY", r.summary + flag(r.summaryFigures), "", "KEY POINTS", ...r.keyPoints.map((k) => `- ${k.text}${flag(k.figures)}`)];
  if (r.sections.length) out.push("", "SECTION BY SECTION", ...r.sections.flatMap((s) => [s.heading.toUpperCase(), s.summary + flag(s.figures), ""]));
  return out.join("\n").trim() + "\n";
}
