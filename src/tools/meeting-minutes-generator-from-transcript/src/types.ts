// Types shared by the route and the browser component (type-only imports).

export interface Attendee {
  name: string;
  role: string | null;
}
export interface Quoted {
  text: string;
  quote: string;
}
export interface ActionItem {
  task: string;
  owner: string | null;
  dueDate: string | null;
  dueText: string | null;
  quote: string;
}

export interface Minutes {
  title: string | null;
  date: string | null;
  attendees: Attendee[];
  agenda: { topic: string; summary: string }[];
  decisions: Quoted[];
  actionItems: ActionItem[];
  openQuestions: Quoted[];
}

export interface Adjustments {
  /** Decisions, action items and open questions whose quote is not in the transcript. */
  droppedDecisions: number;
  droppedActions: number;
  droppedQuestions: number;
  attendeesRemoved: number;
  ownersCleared: number;
  datesCleared: number;
  datesCorrected: number;
  /** The title or the date proposed by the AI is not in the transcript (and none was given in the form). */
  titleCleared: boolean;
  dateCleared: boolean;
}

export type MinutesResult =
  | ({ status: "ok"; referenceDate: string; adjustments: Adjustments; cached: boolean } & Minutes)
  | { status: "needs_clarification" | "refused"; message: string; referenceDate: string; cached: boolean };

export type ApiResponse = { ok: true; data: MinutesResult } | { ok: false; error: { code: string; message: string } };
