import type { GeneratorResult } from "../types";
import { PLATFORMS } from "./checks";
import { toSemicolons } from "./separators";

/** Plain-text version of a result for the download button. */
export function textReport(r: Extract<GeneratorResult, { status: "ok" }>, semicolons: boolean): string {
  const f = (s: string) => (semicolons ? toSemicolons(s) : s);
  const lines = [`Formula (${PLATFORMS.find((p) => p.id === r.platform)?.label}):`, f(r.formula), "", r.explanation];
  if (r.alternative) lines.push("", "Alternative:", f(r.alternative.formula), r.alternative.whenToPrefer);
  if (r.assumptions.length) lines.push("", "Assumptions:", ...r.assumptions.map((a) => `- ${a}`));
  const warnings = [...r.checks.formula.warnings, ...(r.checks.alternative?.warnings ?? [])].map((w) => w.text).concat(r.notes);
  if (warnings.length) lines.push("", "Warnings:", ...warnings.map((w) => `- ${w}`));
  return lines.join("\n") + "\n";
}
