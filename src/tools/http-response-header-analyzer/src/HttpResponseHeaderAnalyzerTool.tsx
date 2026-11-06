"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ResponseData } from "./api/schema";
import { postJson, saveFile } from "./client";
import { MAX_CUSTOM_HEADERS } from "./logic/limits";
import { headersCsv, reportText } from "./logic/report";
import { GRADES, RUBRIC } from "./logic/security";
import type { ServerKind } from "./logic/snippets";
import { EXAMPLE_URL } from "../fixtures/sites";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/http-response-header-analyzer";

type Status = "empty" | "loading" | "done" | "error";


const CHECK_BADGE = {
  pass: { label: "Pass", cls: "bg-green-100 text-green-900" },
  partial: { label: "Weak", cls: "bg-amber-100 text-amber-900" },
  fail: { label: "Missing", cls: "bg-red-100 text-red-900" },
} as const;

const NOTE_BADGE = {
  pass: { label: "Good", cls: "border-green-200 bg-green-50 text-green-900" },
  warn: { label: "Warning", cls: "border-amber-200 bg-amber-50 text-amber-900" },
  fail: { label: "Problem", cls: "border-red-200 bg-red-50 text-red-900" },
  info: { label: "Info", cls: "border-slate-200 bg-slate-50 text-navy" },
} as const;

const TOPIC_LABEL = { caching: "Caching", compression: "Compression", cookies: "Cookies", disclosure: "Information disclosure" } as const;

function gradeColour(grade: string): string {
  if (grade.startsWith("A")) return "bg-green-600";
  if (grade === "B") return "bg-lime-700";
  if (grade === "C") return "bg-amber-700";
  if (grade === "D") return "bg-orange-700";
  return "bg-red-700";
}

export default function HttpResponseHeaderAnalyzerTool() {
  const uid = useId();
  const [url, setUrl] = useState(EXAMPLE_URL);
  const [method, setMethod] = useState<"HEAD" | "GET">("HEAD");
  const [follow, setFollow] = useState(true);
  const [custom, setCustom] = useState<{ name: string; value: string }[]>([]);
  const [status, setStatus] = useState<Status>("empty");
  const [data, setData] = useState<ResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [server, setServer] = useState<ServerKind>("nginx");
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (status !== "loading") return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const analyse = async (target = url) => {
    if (target.trim() === "") {
      setStatus("error");
      setError("Enter a URL, for example https://example.com.");
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setElapsed(0);
    setNotice(null);
    setStatus("loading");
    const res = await postJson<ResponseData>(ENDPOINT, { url: target, method, followRedirects: follow, headers: custom }, ctrl.signal);
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

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Select the text and copy it manually.");
    }
  };

  const groups = data ? (Object.keys(TOPIC_LABEL) as (keyof typeof TOPIC_LABEL)[]).map((t) => ({ topic: t, notes: data.notes.filter((n) => n.topic === t) })).filter((g) => g.notes.length > 0) : [];

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-in`} className="text-lg font-semibold">Analyse a URL</h2>
          <button type="button" className={btnSecondary} onClick={() => { setUrl(EXAMPLE_URL); void analyse(EXAMPLE_URL); }}>Try an example</button>
        </div>
        <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); void analyse(); }}>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor={`${uid}-url`} className="block text-sm font-medium">URL</label>
              <input id={`${uid}-url`} type="text" inputMode="url" autoComplete="url" spellCheck={false} maxLength={2048} className={`${inputCls} mt-1`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
            </div>
            <div>
              <label htmlFor={`${uid}-method`} className="block text-sm font-medium">Method</label>
              <select id={`${uid}-method`} className={`${inputCls} mt-1`} value={method} onChange={(e) => setMethod(e.target.value as "HEAD" | "GET")}>
                <option value="HEAD">HEAD (falls back to GET)</option>
                <option value="GET">GET (first 64 KB)</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={follow} onChange={(e) => setFollow(e.target.checked)} />
            Follow redirects (up to 10) and analyse the final response
          </label>
          <details>
            <summary className={`cursor-pointer rounded text-sm font-medium text-primary-dark ${focusRing}`}>Custom request headers ({custom.length}/{MAX_CUSTOM_HEADERS})</summary>
            <div className="mt-3 space-y-2">
              {custom.map((h, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input aria-label={`Header ${i + 1} name`} className={inputCls} value={h.name} placeholder="Accept-Language" maxLength={64} onChange={(e) => setCustom(custom.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <input aria-label={`Header ${i + 1} value`} className={inputCls} value={h.value} placeholder="en-GB" maxLength={1024} onChange={(e) => setCustom(custom.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  <button type="button" className={btnSecondary} aria-label={`Remove header ${i + 1}`} onClick={() => setCustom(custom.filter((_, j) => j !== i))}>Remove</button>
                </div>
              ))}
              <button type="button" className={btnSecondary} disabled={custom.length >= MAX_CUSTOM_HEADERS} onClick={() => setCustom([...custom, { name: "", value: "" }])}>Add header</button>
              <p className="text-xs text-slate-ink">Headers are sent only to the URL you check and are not stored. Host, Content-Length and similar headers cannot be set.</p>
            </div>
          </details>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={btnPrimary} disabled={status === "loading"}>Analyse headers</button>
            <p className="text-xs text-slate-ink">10 s timeout, 30 checks per 10 minutes. Use this tool only on sites you are allowed to test.</p>
          </div>
        </form>
      </section>

      <section className={card} aria-labelledby={`${uid}-out`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-out`} className="text-lg font-semibold">Result</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} disabled={!data || status !== "done"} onClick={() => data && copy(reportText(data, data), "Report")}>Copy report</button>
            <button type="button" className={btnSecondary} disabled={!data || status !== "done"} onClick={() => data && saveFile(headersCsv(data), "headers.csv", "text/csv;charset=utf-8")}>Headers CSV</button>
            <button type="button" className={btnSecondary} disabled={!data || status !== "done"} onClick={() => data && saveFile(JSON.stringify(data, null, 2), "header-analysis.json", "application/json")}>JSON</button>
          </div>
        </div>
        <div aria-live="polite" className="mt-3 min-h-6 text-sm text-slate-ink">
          {status === "empty" && "Enter a URL or try the example to grade its security, caching and compression headers."}
          {status === "loading" && `Fetching headers… ${elapsed} s`}
          {status === "done" && data && `Grade ${data.security.grade} (${data.security.score}/100) for ${data.finalUrl}, HTTP ${data.status} via ${data.method}.`}
          {notice && <span className="block text-navy">{notice}</span>}
        </div>
        {status === "loading" && (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Fetching headers"><div className="h-full w-1/3 bg-primary motion-safe:animate-pulse" /></div>
            {elapsed >= 1 && <button type="button" className={btnSecondary} onClick={() => { abortRef.current?.abort(); setStatus(data ? "done" : "empty"); setNotice("Check cancelled."); }}>Cancel</button>}
          </div>
        )}
        {status === "error" && error && <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        <div className="mt-4 min-h-64">
          {status === "done" && data ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className={`flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-bold text-white ${gradeColour(data.security.grade)}`} aria-label={`Security grade ${data.security.grade}`}>{data.security.grade}</div>
                <div className="text-sm">
                  <p className="text-lg font-semibold">{data.security.score} / 100 security score</p>
                  <p className="break-all text-slate-ink">{data.finalUrl} · HTTP {data.status} · {data.method} · {data.totalMs} ms</p>
                  {data.redirects.length > 0 && <p className="text-slate-ink">After {data.redirects.length} redirect(s) from {data.requestedUrl}</p>}
                  {data.fallback && <p className="text-amber-900">{data.fallback}</p>}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Security headers</h3>
                <ul className="mt-2 space-y-2">
                  {data.security.checks.map((c) => (
                    <li key={c.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{c.header}</span>
                        <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${CHECK_BADGE[c.status].cls}`}>{CHECK_BADGE[c.status].label}</span>
                        <span className="ml-auto tabular-nums text-slate-ink">{c.points}/{c.max}</span>
                      </div>
                      {c.value && <p className="mt-1 break-all font-mono text-xs text-slate-ink">{c.value.length > 400 ? `${c.value.slice(0, 400)}…` : c.value}</p>}
                      {c.notes.length > 0 && <ul className="mt-1 list-disc pl-5">{c.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
                      {c.fix && <p className="mt-1">Recommended: <code className="break-all rounded bg-slate-100 px-1 font-mono text-xs">{c.header}: {c.fix}</code></p>}
                    </li>
                  ))}
                </ul>
              </div>

              {groups.map((g) => (
                <div key={g.topic}>
                  <h3 className="text-sm font-semibold">{TOPIC_LABEL[g.topic]}</h3>
                  <ul className="mt-2 space-y-2">
                    {g.notes.map((n, i) => (
                      <li key={i} className={`rounded-xl border p-3 text-sm ${NOTE_BADGE[n.level].cls}`}><strong>{NOTE_BADGE[n.level].label}:</strong> {n.message}</li>
                    ))}
                  </ul>
                </div>
              ))}

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Configuration to fix it</h3>
                  <button type="button" className={btnSecondary} onClick={() => copy(data.snippets[server], "Configuration")}>Copy {server === "nginx" ? "Nginx" : server === "apache" ? "Apache" : "Caddy"} config</button>
                </div>
                <div className="mt-2 flex gap-1 border-b border-slate-200" role="tablist" aria-label="Web server">
                  {(["nginx", "apache", "caddy"] as const).map((s) => (
                    <button key={s} type="button" role="tab" id={`${uid}-tab-${s}`} aria-selected={server === s} aria-controls={`${uid}-snippet`} onClick={() => setServer(s)} className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold ${server === s ? "border-primary text-primary-dark" : "border-transparent text-slate-ink hover:text-navy"} ${focusRing}`}>
                      {s === "nginx" ? "Nginx" : s === "apache" ? "Apache" : "Caddy"}
                    </button>
                  ))}
                </div>
                <pre id={`${uid}-snippet`} role="tabpanel" aria-labelledby={`${uid}-tab-${server}`} className="mt-2 max-h-80 overflow-auto rounded-xl bg-slate-50 p-3 font-mono text-xs">{data.snippets[server]}</pre>
              </div>

              <div>
                <h3 className="text-sm font-semibold">All response headers ({data.rows.length})</h3>
                <div className="mt-2 max-h-96 overflow-auto rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50"><tr><th scope="col" className="border-b px-3 py-2 font-semibold">Name</th><th scope="col" className="border-b px-3 py-2 font-semibold">Value</th></tr></thead>
                    <tbody>
                      {data.rows.map((r, i) => (
                        <tr key={i} className="align-top"><td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5 font-mono font-semibold">{r.name}</td><td className="break-all border-b border-slate-100 px-3 py-1.5 font-mono">{r.value}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            status !== "loading" && <p className="text-sm text-slate-ink">The grade, every header and ready-to-paste fixes appear here.</p>
          )}
        </div>
      </section>

      <section className={card} aria-labelledby={`${uid}-rubric`}>
        <h2 id={`${uid}-rubric`} className="text-lg font-semibold">How the grade is calculated</h2>
        <p className="mt-1 text-sm text-slate-ink">Six security headers add up to 100 points. Caching, compression, cookies and information leaks are checked too, but they do not change the grade. Grades: {GRADES.map((g) => `${g.grade} ≥ ${g.min}`).join(", ")}.</p>
        <dl className="mt-3 grid gap-3 md:grid-cols-2">
          {RUBRIC.map((r) => (
            <div key={r.header} className="rounded-xl bg-slate-50 p-3 text-sm">
              <dt className="font-semibold">{r.header} <span className="font-normal text-slate-ink">(up to {r.max})</span></dt>
              <dd><ul className="mt-1 list-disc pl-5">{r.rules.map((x) => <li key={x}>{x}</li>)}</ul></dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
