"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ResponseData } from "./api/schema";
import { reportCsv, reportText } from "./logic/report";
import { USER_AGENTS, type UserAgentId } from "./logic/userAgents";
import { EXAMPLE_URL } from "../fixtures/chains";
import { btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

export const ENDPOINT = "/api/tools/redirect-chain-checker";

type Status = "empty" | "loading" | "done" | "error";


const SEVERITY_STYLE = {
  error: { label: "Problem", cls: "border-red-200 bg-red-50 text-red-900" },
  warning: { label: "Warning", cls: "border-amber-200 bg-amber-50 text-amber-900" },
  info: { label: "Info", cls: "border-slate-200 bg-slate-50 text-navy" },
  good: { label: "Good", cls: "border-green-200 bg-green-50 text-green-900" },
} as const;

function statusStyle(status: number, kind: string): string {
  if (status >= 400 || status === 0) return "bg-red-100 text-red-900";
  if (kind === "permanent") return "bg-primary-soft text-primary-dark";
  if (kind === "temporary") return "bg-amber-100 text-amber-900";
  if (status >= 200 && status < 300) return "bg-green-100 text-green-900";
  return "bg-slate-100 text-navy";
}

export async function postJson<T>(endpoint: string, body: unknown, signal: AbortSignal): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  let res: Response;
  try {
    res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (err) {
    if (signal.aborted) return { ok: false, message: "Check cancelled." };
    return { ok: false, message: err instanceof TypeError ? "Could not reach the checker. Check your internet connection and try again." : "The request failed." };
  }
  try {
    const json = (await res.json()) as { ok: boolean; data?: T; error?: { message?: string } };
    if (json.ok && json.data) return { ok: true, data: json.data };
    return { ok: false, message: json.error?.message ?? "The check failed." };
  } catch {
    return { ok: false, message: `The checker answered with an unexpected response (HTTP ${res.status}). Please try again.` };
  }
}

function save(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function RedirectChainCheckerTool() {
  const uid = useId();
  const [url, setUrl] = useState(EXAMPLE_URL);
  const [userAgent, setUserAgent] = useState<UserAgentId>("default");
  const [status, setStatus] = useState<Status>("empty");
  const [data, setData] = useState<ResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (status !== "loading") return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const check = async (target = url, ua = userAgent) => {
    if (target.trim() === "") {
      setStatus("error");
      setError("Enter a URL, for example http://example.com.");
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setElapsed(0);
    setNotice(null);
    setStatus("loading");
    const res = await postJson<ResponseData>(ENDPOINT, { url: target, userAgent: ua }, ctrl.signal);
    if (ctrl.signal.aborted) return;
    if (res.ok) {
      setData(res.data);
      setError(null);
      setStatus("done");
    } else {
      setError(res.message);
      setStatus("error");
    }
  };

  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(reportText(data, data));
      setNotice("Report copied.");
    } catch {
      setNotice("Your browser blocked clipboard access. Use Download instead.");
    }
  };

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-in`} className="text-lg font-semibold">Check a URL</h2>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              setUrl(EXAMPLE_URL);
              void check(EXAMPLE_URL);
            }}
          >
            Try an example
          </button>
        </div>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            void check();
          }}
        >
          <div>
            <label htmlFor={`${uid}-url`} className="block text-sm font-medium">URL to follow</label>
            <input id={`${uid}-url`} type="text" inputMode="url" autoComplete="url" spellCheck={false} maxLength={2048} className={`${inputCls} mt-1`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://example.com/old-page" aria-describedby={`${uid}-help`} />
          </div>
          <div>
            <label htmlFor={`${uid}-ua`} className="block text-sm font-medium">User agent</label>
            <select id={`${uid}-ua`} className={`${inputCls} mt-1`} value={userAgent} onChange={(e) => setUserAgent(e.target.value as UserAgentId)}>
              {(Object.keys(USER_AGENTS) as UserAgentId[]).map((id) => <option key={id} value={id}>{USER_AGENTS[id].label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button type="submit" className={btnPrimary} disabled={status === "loading"}>Check redirects</button>
            <p id={`${uid}-help`} className="text-xs text-slate-ink">
              No scheme means http://. Up to 10 redirects, 10 s per hop, 10 checks per 10 minutes. Use this tool only on URLs you are allowed to test.
            </p>
          </div>
        </form>
      </section>

      <section className={card} aria-labelledby={`${uid}-out`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-out`} className="text-lg font-semibold">Redirect chain</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} disabled={status !== "done"} onClick={copy}>Copy report</button>
            <button type="button" className={btnSecondary} disabled={status !== "done"} onClick={() => data && save(reportCsv(data), "redirect-chain.csv", "text/csv;charset=utf-8")}>Download CSV</button>
            <button type="button" className={btnSecondary} disabled={status !== "done"} onClick={() => data && save(JSON.stringify(data, null, 2), "redirect-chain.json", "application/json")}>Download JSON</button>
          </div>
        </div>

        <div aria-live="polite" className="mt-3 min-h-6 text-sm text-slate-ink">
          {status === "empty" && "Enter a URL or try the example to see every hop, its status code and timing."}
          {status === "loading" && `Following redirects… ${elapsed} s`}
          {status === "done" && data && `${data.redirectCount} redirect(s), ${data.totalMs} ms in total. Final URL: ${data.finalUrl}`}
          {notice && <span className="block text-navy">{notice}</span>}
        </div>
        {status === "loading" && (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Checking redirects">
              <div className="h-full w-1/3 bg-primary motion-safe:animate-pulse" />
            </div>
            {elapsed >= 1 && <button type="button" className={btnSecondary} onClick={() => { abortRef.current?.abort(); setStatus(data ? "done" : "empty"); setNotice("Check cancelled."); }}>Cancel</button>}
          </div>
        )}
        {status === "error" && error && <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        <div className="mt-4 min-h-64">
          {status === "done" && data ? (
            <>
              {data.recommendation && (
                <p className="rounded-xl border border-primary/30 bg-primary-soft p-3 text-sm"><strong>Recommendation:</strong> {data.recommendation}</p>
              )}
              <ol className="mt-4 space-y-2">
                {data.hops.map((h) => (
                  <li key={h.index} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-slate-ink">Hop {h.index}</span>
                      <span className={`rounded-lg px-2 py-0.5 font-semibold tabular-nums ${statusStyle(h.status, h.kind)}`}>{h.status} {h.statusText}</span>
                      {h.kind !== "none" && <span className="text-xs text-slate-ink">{h.kind === "permanent" ? "permanent" : "temporary"}</span>}
                      <span className="ml-auto text-xs tabular-nums text-slate-ink">{h.ms} ms</span>
                    </div>
                    <p className="mt-1 break-all font-mono text-xs">{h.url}</p>
                    {h.location && <p className="mt-1 break-all font-mono text-xs text-slate-ink">→ {h.location}{h.relativeLocation && ` (sent as “${h.locationRaw}”)`}</p>}
                  </li>
                ))}
                {data.stop && (
                  <li className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                    <strong>Stopped:</strong> {data.stop.message}
                  </li>
                )}
              </ol>
              <h3 className="mt-5 text-sm font-semibold">Findings</h3>
              <ul className="mt-2 space-y-2">
                {data.findings.map((f, i) => (
                  <li key={i} className={`rounded-xl border p-3 text-sm ${SEVERITY_STYLE[f.severity].cls}`}>
                    <strong>{SEVERITY_STYLE[f.severity].label}:</strong> {f.message}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-ink">Checked as: {USER_AGENTS[data.userAgent].label}. Timings are measured from our server, not from your location.</p>
            </>
          ) : (
            status !== "loading" && <p className="text-sm text-slate-ink">The hops appear here as a chain, with recommendations.</p>
          )}
        </div>
      </section>
    </div>
  );
}
