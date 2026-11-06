// Response types shared by the route and the browser component (type-only imports).
import type { QuotaNote } from "./logic/quotas";
import type { ReviewItem } from "./logic/safety";
import type { DetectedScope } from "./logic/scopes";
import type { TriggerId } from "./logic/triggers";

export type SyntaxSummary = { ok: true } | { ok: false; line: number; column: number; message: string };

export type GeneratorResult =
  | {
      status: "ok";
      trigger: TriggerId;
      summary: string;
      script: string;
      installSteps: string[];
      assumptions: string[];
      syntax: SyntaxSummary;
      /** From our own service table, not from the model. */
      scopes: DetectedScope[];
      modelScopes: string[];
      scopeDifference: { extra: string[]; missing: string[] } | null;
      triggerWarnings: string[];
      quotas: QuotaNote[];
      review: ReviewItem[];
      cached: boolean;
    }
  | { status: "needs_clarification" | "refused"; trigger: TriggerId; message: string; cached: boolean };

export type ApiResponse = { ok: true; data: GeneratorResult } | { ok: false; error: { code: string; message: string } };
