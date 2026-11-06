import type { Brief, ImproveResult } from "../types";
import { guardDraft, type Draft } from "./guard";

export type Answer = ({ status: "ok" } & Draft) | { status: "needs_clarification" | "refused"; message: string };

export function buildResult(answer: Answer, brief: Brief, cached: boolean): ImproveResult {
  if (answer.status !== "ok") return { status: answer.status, message: answer.message, cached };
  return { status: "ok", ...guardDraft(answer, brief), cached };
}
