import type { MacroResult, Risk } from "../types";
import { detect, platformNotes } from "./detector";
import { splitLines } from "./vbaText";

type Status = { status: "needs_clarification" | "refused"; message: string };
export type GenerateAnswer = { status: "ok"; summary: string; code: string; howToRun: string[]; assumptions: string[]; risks: Risk[] } | Status;
export type ExplainAnswer = { status: "ok"; summary: string; lines: { from: number; to: number; text: string }[]; risks: Risk[] } | Status;

export function generateResult(answer: GenerateAnswer, cached: boolean): MacroResult {
  if (answer.status !== "ok") return { mode: "generate", status: answer.status, message: answer.message, safety: [], platformNotes: [], cached };
  const lineCount = splitLines(answer.code).length;
  return {
    mode: "generate",
    status: "ok",
    summary: answer.summary,
    code: answer.code,
    howToRun: answer.howToRun,
    assumptions: answer.assumptions,
    safety: detect(answer.code),
    platformNotes: platformNotes(answer.code),
    modelRisks: answer.risks.map((r) => ({ ...r, line: r.line !== null && r.line <= lineCount ? r.line : null })),
    cached,
  };
}

/** Keep only line ranges inside the pasted code; list non-blank lines that no kept range explains. */
export function explainResult(answer: ExplainAnswer, code: string, cached: boolean): MacroResult {
  const safety = detect(code);
  const notes = platformNotes(code);
  if (answer.status !== "ok") return { mode: "explain", status: answer.status, message: answer.message, safety, platformNotes: notes, cached };
  const src = splitLines(code);
  const kept = answer.lines.filter((l) => l.from >= 1 && l.to >= l.from && l.to <= src.length);
  const covered = new Set<number>();
  for (const l of kept) for (let n = l.from; n <= l.to; n++) covered.add(n);
  const unexplained = src.map((t, i) => (t.trim() && !covered.has(i + 1) ? i + 1 : 0)).filter(Boolean);
  return {
    mode: "explain",
    status: "ok",
    code,
    summary: answer.summary,
    lines: kept,
    dropped: answer.lines.length - kept.length,
    unexplained,
    safety,
    platformNotes: notes,
    modelRisks: answer.risks.map((r) => ({ ...r, line: r.line !== null && r.line <= src.length ? r.line : null })),
    cached,
  };
}
