// Response types shared by the route and the browser component (no runtime imports).

export interface ActionItem {
  task: string;
  owner: string | null;
  dueDate: string | null;
  dueText: string | null;
  quote: string;
}

export interface Adjustments {
  /** Items dropped because their quote is not in the text. */
  droppedQuotes: number;
  /** Owners set to Unassigned because the name is not in the text. */
  ownersCleared: number;
  /** Due dates removed (not a valid date, or more than 5 years from the reference date). */
  datesCleared: number;
  /** Due dates replaced by our own resolution of the written phrase. */
  datesCorrected: number;
}

export type ExtractResult =
  | { status: "ok"; referenceDate: string; items: ActionItem[]; count: number; adjustments: Adjustments; cached: boolean }
  | { status: "needs_clarification" | "refused"; referenceDate: string; message: string; cached: boolean };

export type ApiResponse = { ok: true; data: ExtractResult } | { ok: false; error: { code: string; message: string } };
