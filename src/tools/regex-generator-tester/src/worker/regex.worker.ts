/// <reference lib="webworker" />
import { findMatches, type MatchResult } from "../logic/match";

export type WorkerRequest = { jobId: number; source: string; flags: string; text: string; replacement: string | null };
export type WorkerResponse = ({ jobId: number; ok: true; ms: number } & MatchResult) | { jobId: number; ok: false; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

// The page terminates this worker if a job runs past the time limit, which is
// the only way to stop a regex that backtracks catastrophically.
ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { jobId, source, flags, text, replacement } = event.data;
  const t0 = performance.now();
  try {
    const r = findMatches(source, flags, text, replacement);
    ctx.postMessage({ jobId, ok: true, ms: Math.round(performance.now() - t0), ...r } satisfies WorkerResponse);
  } catch (e) {
    ctx.postMessage({ jobId, ok: false, message: e instanceof RangeError ? "The result is too large for this browser's memory." : (e as Error).message } satisfies WorkerResponse);
  }
};
