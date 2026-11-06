import type { SummaryResult } from "../types";
import { checkFigures, sourceDigits } from "./figures";
import { reduction, wordCount } from "./stats";
import { containsCollapsed } from "./text";

export type Answer =
  | { status: "ok"; summary: string; keyPoints: { text: string; quote: string }[]; sections: { heading: string; summary: string }[] }
  | { status: "needs_clarification" | "refused"; message: string };

/** Our checks: figures and quotes are marked (never silently removed), lengths are computed here. */
export function buildResult(answer: Answer, input: { text: string; sections: boolean }, cached: boolean): SummaryResult {
  if (answer.status !== "ok") return { status: answer.status, message: answer.message, cached };
  const digits = sourceDigits(input.text);
  const summaryFigures = checkFigures(answer.summary, digits);
  const keyPoints = answer.keyPoints.map((k) => ({ text: k.text, quote: k.quote, verified: containsCollapsed(input.text, k.quote), figures: checkFigures(k.text, digits) }));
  // The digest is only shown when the visitor asked for it.
  const sections = input.sections ? answer.sections.map((s) => ({ heading: s.heading, summary: s.summary, figures: checkFigures(`${s.heading} ${s.summary}`, digits) })) : [];
  const all = [...summaryFigures, ...keyPoints.flatMap((k) => k.figures), ...sections.flatMap((s) => s.figures)];
  const originalWords = wordCount(input.text);
  const summaryWords = wordCount(answer.summary);
  return {
    status: "ok",
    summary: answer.summary,
    summaryFigures,
    keyPoints,
    sections,
    stats: { originalWords, originalChars: input.text.length, summaryWords, reductionPercent: reduction(originalWords, summaryWords) },
    unverifiedFigures: all.filter((f) => !f.found).length,
    unverifiedQuotes: keyPoints.filter((k) => !k.verified).length,
    cached,
  };
}
