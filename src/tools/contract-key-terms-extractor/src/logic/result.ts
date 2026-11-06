import { CATEGORIES, LEGAL_QUESTION_NOTE, type CategoryId } from "../limits";
import type { ExtractResult, Term } from "../types";
import { verifyClauseRef } from "./clauses";
import { verifyNormalised } from "./normalise";
import { containsCollapsed } from "./text";

export type Answer = { status: "ok"; terms: Term[]; notes: string[] } | { status: "needs_clarification" | "refused"; message: string };

/** Questions about validity, enforceability or legal advice are never answered (the extraction still runs). */
const LEGAL_QUESTION = /\b(valid(ity)?|enforce(able|ability)?|legal(ly)?|lawful|unlawful|binding|void|loophole|sue|lawsuit|should I sign|can (I|we) (get out|break|cancel|terminate)|is (this|it|that) (fair|ok|okay|normal|standard)|advice|advise)\b/i;

export function isLegalQuestion(focus: string): boolean {
  return LEGAL_QUESTION.test(focus);
}

export function buildResult(answer: Answer, input: { text: string; focus: string }, cached: boolean): ExtractResult {
  const notes: string[] = isLegalQuestion(input.focus) ? [LEGAL_QUESTION_NOTE] : [];
  if (answer.status !== "ok") return { status: answer.status, message: answer.message, notes, cached };
  const adjustments = { droppedQuotes: 0, normalisedCleared: 0, clauseRefsCleared: 0 };
  const terms: Term[] = [];
  for (const t of answer.terms) {
    if (!containsCollapsed(input.text, t.quote)) {
      adjustments.droppedQuotes++;
      continue;
    }
    const normalised = verifyNormalised(t.normalised, t.quote);
    if (t.normalised !== null && normalised === null) adjustments.normalisedCleared++;
    const clauseRef = verifyClauseRef(t.clauseRef, t.quote, input.text);
    if (t.clauseRef && clauseRef === null) adjustments.clauseRefsCleared++;
    terms.push({ ...t, normalised, clauseRef });
  }
  const order = CATEGORIES.map((c) => c.id as CategoryId);
  terms.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  const found = new Set(terms.map((t) => t.category));
  // Model notes that answer a legal question are not shown; ours replaces them.
  const modelNotes = answer.notes.filter((n) => !(notes.length && LEGAL_QUESTION.test(n)));
  return { status: "ok", terms, notFound: order.filter((c) => c !== "other" && !found.has(c)), notes: [...notes, ...modelNotes], adjustments, cached };
}
