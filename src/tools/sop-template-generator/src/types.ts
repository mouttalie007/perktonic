// Types shared by the route and the browser component (type-only imports).
import type { DocTypeId } from "./limits";

export interface Brief {
  docType: DocTypeId;
  processName: string;
  industry: string;
  teamSize: string;
  steps: string;
  owner: string;
}

export interface Role {
  role: string;
  responsibility: string;
}
export interface Step {
  n: number;
  action: string;
  owner: string;
}
export interface Kpi {
  name: string;
  howMeasured: string;
}
export interface Revision {
  version: string;
  date: string;
  author: string;
  change: string;
}

/** The editable document: always the six sections of SECTIONS. */
export interface SopDoc {
  title: string;
  docType: DocTypeId;
  purpose: string;
  scope: string;
  roles: Role[];
  steps: Step[];
  kpis: Kpi[];
  revisions: Revision[];
}

/** What the server changed in the AI's draft, shown to the visitor. */
export interface Removal {
  field: string;
  text: string;
  reason: "regulation" | "figure" | "company";
}

export type ImproveResult =
  | {
      status: "ok";
      purpose: string;
      scope: string;
      roles: Role[];
      steps: Step[];
      kpis: Kpi[];
      notes: string[];
      removed: Removal[];
      /** Visitor steps that are not in the AI's steps any more (reworded or left out). */
      missingSteps: string[];
      cached: boolean;
    }
  | { status: "needs_clarification" | "refused"; message: string; cached: boolean };

export type ApiResponse = { ok: true; data: ImproveResult } | { ok: false; error: { code: string; message: string } };
