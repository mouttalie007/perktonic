// Response types shared by the route and the browser component (no runtime imports).

export interface Figure {
  text: string;
  found: boolean;
}

export interface KeyPoint {
  text: string;
  quote: string;
  /** false when the quote is not in the text (shown with a "not verified" label, never dropped). */
  verified: boolean;
  figures: Figure[];
}

export interface Section {
  heading: string;
  summary: string;
  figures: Figure[];
}

export type SummaryResult =
  | {
      status: "ok";
      summary: string;
      summaryFigures: Figure[];
      keyPoints: KeyPoint[];
      sections: Section[];
      stats: { originalWords: number; originalChars: number; summaryWords: number; reductionPercent: number };
      /** Figures that are not in the source text, all fields together. */
      unverifiedFigures: number;
      unverifiedQuotes: number;
      cached: boolean;
    }
  | { status: "needs_clarification" | "refused"; message: string; cached: boolean };

export type ApiResponse = { ok: true; data: SummaryResult } | { ok: false; error: { code: string; message: string } };
