// Server-side rules, never delegated to the model (and also written in the prompt).
import { MAX_YEARS_FROM_REFERENCE } from "../limits";
import type { OkModelAnswer } from "../llm/schema";
import type { Adjustments, MinutesResult } from "../types";
import { parseIso, resolveDue, withinWindow } from "./dates";
import { containsCollapsed } from "./text";
import { datesInAny } from "./writtenDates";

type Answer = OkModelAnswer | { status: "needs_clarification" | "refused"; message: string };

export interface Context {
  transcript: string;
  title: string;
  date: string;
  referenceDate: string;
}

/** A name "occurs in the text" when it, or its first name, is written there as a whole word (case-insensitive). */
export function nameInText(name: string, text: string): boolean {
  const word = (w: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}([^\\p{L}\\p{N}]|$)`, "iu").test(text);
  const full = name.trim();
  if (full && word(full)) return true;
  const first = full.split(/\s+/)[0];
  return first.length >= 2 && word(first);
}

export function buildResult(answer: Answer, ctx: Context, cached: boolean): MinutesResult {
  const ref = ctx.referenceDate;
  if (answer.status !== "ok") return { status: answer.status, message: answer.message, referenceDate: ref, cached };
  const t = ctx.transcript;
  const adj: Adjustments = { droppedDecisions: 0, droppedActions: 0, droppedQuestions: 0, attendeesRemoved: 0, ownersCleared: 0, datesCleared: 0, datesCorrected: 0, titleCleared: false, dateCleared: false };
  const inText = (q: string) => containsCollapsed(t, q);

  const decisions = answer.decisions.filter((d) => inText(d.quote));
  adj.droppedDecisions = answer.decisions.length - decisions.length;
  const openQuestions = answer.openQuestions.filter((q) => inText(q.quote));
  adj.droppedQuestions = answer.openQuestions.length - openQuestions.length;

  const attendees = answer.attendees.filter((a) => nameInText(a.name, t));
  adj.attendeesRemoved = answer.attendees.length - attendees.length;

  const actionItems = [];
  for (const raw of answer.actionItems) {
    if (!inText(raw.quote)) {
      adj.droppedActions++;
      continue;
    }
    const item = { ...raw };
    if (item.owner !== null && !nameInText(item.owner, t)) {
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
    actionItems.push(item);
  }

  // The title and the date come from the form, or from the transcript itself; never invented.
  let title = ctx.title.trim() || answer.title;
  if (!ctx.title.trim() && title && !containsCollapsed(t, title, true)) {
    title = null;
    adj.titleCleared = true;
  }
  let date = ctx.date.trim() && parseIso(ctx.date) ? ctx.date.trim() : answer.date;
  if (!ctx.date.trim() && date && !datesInAny(t).has(date)) {
    date = null;
    adj.dateCleared = true;
  }
  return { status: "ok", referenceDate: ref, title, date, attendees, agenda: answer.agenda, decisions, actionItems, openQuestions, adjustments: adj, cached };
}
