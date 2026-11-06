import { parseRobots, testPath, type ParsedRobots, type Verdict } from "../logic/robots";

export type WorkerRequest =
  | { type: "load"; text: string | null; state: "found" | "missing" | "error" }
  | { type: "test"; jobId: number; urls: string[]; userAgents: string[] };

export type WorkerResponse = { jobId: number; verdicts: { url: string; ua: string; v: Verdict }[] };

// A 500 KiB robots.txt can hold over 10,000 rules; testing 50 URL/crawler pairs against it takes a few hundred ms, so it runs here.
let parsed: ParsedRobots | null = null;
let state: "found" | "missing" | "error" = "missing";

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const m = event.data;
  if (m.type === "load") {
    state = m.state;
    parsed = m.text !== null && m.state === "found" ? parseRobots(m.text) : null;
    return;
  }
  const verdicts: WorkerResponse["verdicts"] = [];
  for (const url of m.urls) {
    for (const ua of m.userAgents) {
      let v: Verdict;
      try {
        v = parsed ? testPath(parsed, url, ua) : state === "missing" ? { allowed: true, rule: null, group: null, explanation: "There is no robots.txt, so everything is allowed." } : { allowed: false, rule: null, group: null, explanation: "robots.txt could not be fetched, so Google treats the whole site as blocked for now." };
      } catch {
        v = { allowed: false, rule: null, group: null, explanation: "This is not a valid URL or path." };
      }
      verdicts.push({ url, ua, v });
    }
  }
  (self as unknown as Worker).postMessage({ jobId: m.jobId, verdicts } satisfies WorkerResponse);
};
