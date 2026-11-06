import { MAX_YEARS_FROM_REFERENCE } from "../limits";
import type { ActionItem, Adjustments, ExtractResult } from "../types";
import { resolveDue, withinWindow } from "./dates";
import { containsCollapsed } from "./text";

export type Answer = { status: "ok"; items: ActionItem[] } | { status: "needs_clarification" | "refused"; message: string };

/** The server-side rules: never delegated to the model, never inventing an owner or a deadline. */
export function buildResult(answer: Answer, input: { text: string; referenceDate: string }, cached: boolean): ExtractResult {
  const ref = input.referenceDate;
  if (answer.status !== "ok") return { status: answer.status, referenceDate: ref, message: answer.message, cached };
  const adj: Adjustments = { droppedQuotes: 0, ownersCleared: 0, datesCleared: 0, datesCorrected: 0 };
  const items: ActionItem[] = [];
  for (const raw of answer.items) {
    if (!containsCollapsed(input.text, raw.quote)) {
      adj.droppedQuotes++;
      continue;
    }
    const item = { ...raw };
    if (item.owner !== null && !containsCollapsed(input.text, item.owner, true)) {
      item.owner = null;
      adj.ownersCleared++;
    }
    const ours = resolveDue(item.dueText, ref);
    if (ours && ours !== item.dueDate && withinWindow(ours, ref, MAX_YEARS_FROM_REFERENCE)) {
      item.dueDate = ours;
      adj.datesCorrected++;
    } else if (item.dueDate !== null && !withinWindow(item.dueDate, ref, MAX_YEARS_FROM_REFERENCE)) {
      item.dueDate = null;
      adj.datesCleared++;
    }
    items.push(item);
  }
  return { status: "ok", referenceDate: ref, items, count: items.length, adjustments: adj, cached };
}
