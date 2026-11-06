// Response types shared by the route and the browser component (type-only imports).
import type { CategoryId } from "./limits";

export type NormalisedValue = string | { amount: number; currency: string } | null;

export interface Term {
  category: CategoryId;
  label: string;
  value: string;
  normalised: NormalisedValue;
  clauseRef: string | null;
  quote: string;
}

export type ExtractResult =
  | {
      status: "ok";
      terms: Term[];
      /** Categories with nothing found: shown as "Not found in this text", never filled in. */
      notFound: CategoryId[];
      notes: string[];
      adjustments: { droppedQuotes: number; normalisedCleared: number; clauseRefsCleared: number };
      cached: boolean;
    }
  | { status: "needs_clarification" | "refused"; message: string; notes: string[]; cached: boolean };

export type ApiResponse = { ok: true; data: ExtractResult } | { ok: false; error: { code: string; message: string } };
