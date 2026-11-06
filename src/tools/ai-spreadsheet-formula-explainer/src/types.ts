// Response types shared by the route and the browser component (no runtime imports).

export interface NarrationStep {
  part: string;
  text: string;
}

export type Narration =
  | { status: "ok"; formula: string; summary: string; steps: NarrationStep[]; dropped: number; cached: boolean }
  | { status: "needs_clarification" | "refused"; formula: string; message: string; cached: boolean };

export type ApiResponse = { ok: true; data: Narration } | { ok: false; error: { code: string; message: string } };
