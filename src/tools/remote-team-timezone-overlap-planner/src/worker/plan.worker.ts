/// <reference lib="webworker" />
import { computeDay, explainWindow, hm, outlook, PlanError, utcOffsetLabel, validatePlan, type DayResult, type OutlookChange, type Plan } from "../logic/overlap";
import { isValidTimeZone } from "../logic/timezone";

export type WorkerRequest = { jobId: number; plan: Plan; weeks: number };

export type WorkerResponse =
  | {
      type: "result";
      jobId: number;
      day: DayResult;
      explanations: string[];
      outlook: { base: number; changes: OutlookChange[] };
      /** Per person: local time at the start of the view day and the zone's UTC offset then, for row labels. */
      labels: { offset: string }[];
      hours: { t: number; label: string }[];
    }
  | { type: "error"; jobId: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { jobId, plan, weeks } = event.data;
  try {
    validatePlan(plan, isValidTimeZone);
    const day = computeDay(plan);
    const hours = day.slots.filter((s) => hm(s.t, plan.viewZone).endsWith(":00")).map((s) => ({ t: s.t, label: hm(s.t, plan.viewZone).slice(0, 2) }));
    ctx.postMessage({
      type: "result",
      jobId,
      day,
      explanations: day.best.map((w) => explainWindow(w, plan, plan.people.length)),
      outlook: outlook(plan, weeks * 7),
      labels: plan.people.map((p) => ({ offset: utcOffsetLabel(day.dayStart, p.zone) })),
      hours,
    } satisfies WorkerResponse);
  } catch (err) {
    ctx.postMessage({ type: "error", jobId, message: err instanceof PlanError ? err.message : "Something went wrong while comparing the time zones." } satisfies WorkerResponse);
  }
};
