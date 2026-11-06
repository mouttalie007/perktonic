// Response types shared by the route and the browser component (no runtime imports).

export type AiRule =
  | {
      status: "ok";
      kind: "conditional_formatting" | "data_validation";
      formula: string;
      appliesTo: string;
      formatSuggestion: string | null;
      stepsExcel: string[];
      stepsSheets: string[];
      notes: string[];
      assumptions: string[];
      /** Our own checks: brackets and quotes, function names, anchors. */
      warnings: string[];
      cached: boolean;
    }
  | { status: "needs_clarification" | "refused"; message: string; cached: boolean };

export type ApiResponse = { ok: true; data: AiRule } | { ok: false; error: { code: string; message: string } };
