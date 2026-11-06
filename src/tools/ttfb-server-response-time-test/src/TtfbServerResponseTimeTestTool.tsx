"use client";

import { useEffect, useId, useRef, useState } from "react";
import { reportText, runsCsv } from "./logic/report";
import { MAX_URL_LENGTH, RATE_LIMIT, RATING_LABEL, RUNS, TEST_LOCATION, THRESHOLDS, THRESHOLD_SOURCE, type Phases, type Rating, type Result } from "./logic/types";
import { normalizeUrl } from "./logic/url";
import { EXAMPLE_URL } from "../fixtures/examples";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/ttfb-server-response-time-test";


const PHASES: { key: "dnsMs" | "connectMs" | "tlsMs" | "waitMs" | "downloadMs"; label: string; help: string; color: string }[] = [
  { key: "dnsMs", label: "DNS", help: "finding the server's IP address", color: "bg-teal-500" },
  { key: "connectMs", label: "Connect", help: "opening the TCP connection", color: "bg-amber-500" },
  { key: "tlsMs", label: "TLS", help: "the HTTPS handshake", color: "bg-violet-500" },
  { key: "waitMs", label: "Wait", help: "the server preparing the response", color: "bg-primary" },
  { key: "downloadMs", label: "Download", help: "receiving the body (total − TTFB)", color: "bg-green-600" },
];

const RATING_CLS: Record<Rating, string> = {
  good: "bg-green-100 text-green-900 border-green-300",
  "needs-improvement": "bg-amber-100 text-amber-950 border-amber-300",
  poor: "bg-red-100 text-red-900 border-red-300",
};

const fmt = (ms: number | null) => (ms === null ? "n/a" : `${ms.toLocaleString("en-US")} ms`);

function save(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Bar({ label, phases, scale }: { label: string; phases: Phases; scale: number }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-2 text-xs sm:grid-cols-[6rem_1fr_5rem]">
      <span className="font-semibold text-slate-700">{label}</span>
      <div className="flex h-5 overflow-hidden rounded bg-slate-100" aria-hidden="true">
        {PHASES.map((p) => {
          const v = phases[p.key];
          if (!v) return null;
          return <div key={p.key} className={`${p.color} h-full`} style={{ width: `${(v / scale) * 100}%` }} title={`${p.label}: ${v} ms`} />;
        })}
      </div>
      <span className="text-right font-mono text-slate-700">{phases.totalMs.toLocaleString("en-US")} ms</span>
    </div>
  );
}

export default function TtfbServerResponseTimeTestTool() {
  const uid = useId();
  // Kind B: the field is pre-filled, but nothing is requested until the visitor asks.
  const [url, setUrl] = useState(EXAMPLE_URL);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultHeading = useRef<HTMLHeadingElement | null>(null);

  useEffect(
    () => () => {
      abort.current?.abort();
      if (slowTimer.current) clearTimeout(slowTimer.current);
    },
    [],
  );

  const test = async (target: string) => {
    const check = normalizeUrl(target);
    if (!check.ok) {
      setResult(null);
      setError(check.error);
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setSlow(false);
    setError(null);
    setNotice(null);
    if (slowTimer.current) clearTimeout(slowTimer.current);
    slowTimer.current = setTimeout(() => setSlow(true), 1000);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: check.url }), signal: ctrl.signal });
      let body: { ok: true; data: Result } | { ok: false; error: { code: string; message: string } };
      try {
        body = await res.json();
      } catch {
        throw new Error(res.status === 429 ? `You have run ${RATE_LIMIT.limit} tests in the last 10 minutes. Try again in a few minutes.` : "The tester did not answer properly. Please try again in a moment.");
      }
      if (body.ok) {
        setResult(body.data);
        setTimeout(() => resultHeading.current?.focus(), 0);
      } else {
        setResult(null);
        setError(body.error.message);
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setResult(null);
      setError(e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not reach the tester. Check your connection and try again.");
    } finally {
      if (abort.current === ctrl) {
        setBusy(false);
        setSlow(false);
        if (slowTimer.current) clearTimeout(slowTimer.current);
      }
    }
  };

  const cancel = () => {
    abort.current?.abort();
    abort.current = null;
    setBusy(false);
    setSlow(false);
    setNotice("Test cancelled.");
  };

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Use the downloads instead.");
    }
  };

  const okRuns = result?.runs.filter((r): r is Extract<Result["runs"][number], { ok: true }> => r.ok) ?? [];
  const scale = Math.max(1, ...okRuns.map((r) => r.phases.totalMs), result?.median?.totalMs ?? 0);
  const m = result?.median ?? null;
  const markerPct = m ? Math.min(100, (m.ttfbMs / (THRESHOLDS.poorMs * 1.5)) * 100) : 0;
  const host = result ? new URL(result.url).hostname : "";

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Page to test
        </h2>
        <form
          className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void test(url);
          }}
        >
          <div className="min-w-0 flex-1">
            <label htmlFor={`${uid}-url`} className="block text-sm text-slate-600">
              URL
            </label>
            <input id={`${uid}-url`} type="text" inputMode="url" autoComplete="url" spellCheck={false} className={`${inputCls} mt-1 font-mono`} value={url} maxLength={MAX_URL_LENGTH} onChange={(e) => setUrl(e.target.value)} aria-invalid={error ? true : undefined} placeholder="https://example.com" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              Test TTFB
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={busy}
              onClick={() => {
                setUrl(EXAMPLE_URL);
                void test(EXAMPLE_URL);
              }}
            >
              Try an example
            </button>
          </div>
        </form>
        <p className="mt-3 text-xs text-slate-600">
          Each test requests the URL {RUNS} times, one after another and 500 ms apart, from {TEST_LOCATION}. Redirects are not followed. Limit: {RATE_LIMIT.limit} tests per 10 minutes.
        </p>
      </section>

      <div aria-live="polite" className="min-h-6 text-sm text-slate-700">
        {busy && (
          <div className="flex flex-wrap items-center gap-3">
            <span>Measuring {RUNS} runs, 500 ms apart…</span>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Measuring">
              <div className="h-full w-1/3 bg-primary motion-safe:animate-pulse" />
            </div>
            {slow && (
              <button type="button" className={btnSecondary} onClick={cancel}>
                Cancel
              </button>
            )}
          </div>
        )}
        {!busy && notice && <span>{notice}</span>}
        {!busy && !result && !error && !notice && <span>Press “Test TTFB” to measure the URL above. Nothing is requested until you do.</span>}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {result && m && result.rating && (
        <>
          <section className={card} aria-labelledby={`${uid}-res`}>
            <h2 id={`${uid}-res`} ref={resultHeading} tabIndex={-1} className="break-all text-lg font-semibold outline-none">
              {host}
            </h2>
            <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
              <div>
                <p className="text-sm text-slate-600">Time to first byte (median)</p>
                <p className="flex flex-wrap items-center gap-3">
                  <span className="text-4xl font-bold tabular-nums">{m.ttfbMs.toLocaleString("en-US")} ms</span>
                  <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${RATING_CLS[result.rating]}`}>{RATING_LABEL[result.rating]}</span>
                </p>
              </div>
              <div className="text-sm text-slate-700">
                <p>
                  Total {fmt(m.totalMs)} · HTTP {result.status}
                  {result.ipVersion && ` · IPv${result.ipVersion}`}
                </p>
                <p className="font-semibold text-navy">
                  Median of {okRuns.length} run{okRuns.length === 1 ? "" : "s"}, measured from {TEST_LOCATION}. Visitors elsewhere will see different times.
                </p>
              </div>
            </div>

            {result.redirect && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <p>
                  This URL redirects (<strong>{result.redirect.status}</strong>) to <span className="break-all font-mono">{result.redirect.location}</span>. The times above are for the redirect response only, not for the page itself.
                </p>
                <button
                  type="button"
                  className={`${btnSecondary} mt-2`}
                  disabled={busy}
                  onClick={() => {
                    setUrl(result.redirect!.location);
                    void test(result.redirect!.location);
                  }}
                >
                  Test the redirect target
                </button>
              </div>
            )}
            {!result.redirect && result.status !== null && result.status >= 400 && (
              <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">The server answered with an error status ({result.status}), so these are the times for its error page.</p>
            )}

            <div className="mt-5">
              <div className="relative h-3 overflow-hidden rounded-full" aria-hidden="true">
                <div className="absolute inset-y-0 left-0 bg-green-500" style={{ width: `${(THRESHOLDS.goodMs / (THRESHOLDS.poorMs * 1.5)) * 100}%` }} />
                <div className="absolute inset-y-0 bg-amber-400" style={{ left: `${(THRESHOLDS.goodMs / (THRESHOLDS.poorMs * 1.5)) * 100}%`, width: `${((THRESHOLDS.poorMs - THRESHOLDS.goodMs) / (THRESHOLDS.poorMs * 1.5)) * 100}%` }} />
                <div className="absolute inset-y-0 right-0 bg-red-500" style={{ left: `${(THRESHOLDS.poorMs / (THRESHOLDS.poorMs * 1.5)) * 100}%` }} />
              </div>
              <div className="relative h-4" aria-hidden="true">
                <span className="absolute -translate-x-1/2 text-xs font-bold text-navy" style={{ left: `${markerPct}%` }}>
                  ▲
                </span>
              </div>
              <p className="text-xs text-slate-700">
                Good ≤ {THRESHOLDS.goodMs} ms · needs improvement ≤ {THRESHOLDS.poorMs.toLocaleString("en-US")} ms · poor above. Source:{" "}
                <a className={`underline ${focusRing}`} href={THRESHOLD_SOURCE.url} target="_blank" rel="noopener noreferrer">
                  {THRESHOLD_SOURCE.title}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                . Google applies them to the 75th percentile of real visits; a lab test like this one is a single sample.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className={btnSecondary} onClick={() => copy(reportText(result), "Report")}>
                Copy report
              </button>
              <button type="button" className={btnSecondary} onClick={() => save(runsCsv(result), `ttfb-${host}.csv`, "text/csv;charset=utf-8")}>
                Download CSV
              </button>
              <button type="button" className={btnSecondary} onClick={() => save(JSON.stringify(result, null, 2), `ttfb-${host}.json`, "application/json")}>
                Download JSON
              </button>
            </div>
          </section>

          <section className={card} aria-labelledby={`${uid}-wf`}>
            <h2 id={`${uid}-wf`} className="text-lg font-semibold">
              Waterfall
            </h2>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
              {PHASES.map((p) => (
                <li key={p.key} className="flex items-center gap-1.5">
                  <span className={`inline-block h-3 w-3 rounded-sm ${p.color}`} aria-hidden="true" />
                  <span>
                    <strong>{p.label}</strong>: {p.help}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2">
              <Bar label="Median" phases={m} scale={scale} />
              {result.runs.map((r) =>
                r.ok ? (
                  <Bar key={r.n} label={`Run ${r.n}`} phases={r.phases} scale={scale} />
                ) : (
                  <div key={r.n} className="grid grid-cols-[4.5rem_1fr] gap-2 text-xs sm:grid-cols-[6rem_1fr]">
                    <span className="font-semibold text-slate-700">Run {r.n}</span>
                    <span className="text-red-800">{r.message}</span>
                  </div>
                ),
              )}
            </div>
            <div className={`relative mt-5 overflow-x-auto rounded ${focusRing}`} role="region" aria-label="Phase timings table" tabIndex={0}>
              <table className="w-full min-w-[30rem] text-left text-sm">
                <caption className="sr-only">Time spent in each phase, median and per run, in milliseconds</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-600">
                    <th scope="col" className="py-1 pr-3 font-semibold">
                      Phase
                    </th>
                    <th scope="col" className="py-1 pr-3 text-right font-semibold">
                      Median
                    </th>
                    {result.runs.map((r) => (
                      <th key={r.n} scope="col" className="py-1 pr-3 text-right font-semibold">
                        Run {r.n}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono text-xs">
                  {[...PHASES.map((p) => ({ key: p.key, label: p.label })), { key: "ttfbMs" as const, label: "TTFB" }, { key: "totalMs" as const, label: "Total" }].map((row) => (
                    <tr key={row.key} className={`border-b border-slate-100 ${row.key === "ttfbMs" ? "font-bold" : ""}`}>
                      <th scope="row" className="py-1 pr-3 text-left font-sans font-semibold">
                        {row.label}
                      </th>
                      <td className="py-1 pr-3 text-right">{fmt(m[row.key])}</td>
                      {result.runs.map((r) => (
                        <td key={r.n} className="py-1 pr-3 text-right">
                          {r.ok ? fmt(r.phases[row.key]) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(m.dnsMs === null || m.connectMs === null || m.tlsMs === null) && <p className="mt-2 text-xs text-slate-600">“n/a” means the measuring client did not report that phase (for example on a reused connection or plain http://). The wait then includes it.</p>}
          </section>

          <section className={card} aria-labelledby={`${uid}-sug`}>
            <h2 id={`${uid}-sug`} className="text-lg font-semibold">
              What to look at
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-800">
              {result.suggestions.map((s, i) => (
                <li key={i}>{s.text}</li>
              ))}
            </ul>
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {[
                ["Server IP", result.remoteIp ? `${result.remoteIp}${result.ipVersion ? ` (IPv${result.ipVersion})` : ""}` : "not reported"],
                ["Server header", result.server ?? "none"],
                ["Cache", result.cache ?? "no cache header seen"],
                ["Compression", result.compression ?? "none"],
                ["Protocol", result.protocolHint ?? "No HTTP/2 or HTTP/3 advertisement in the headers."],
                ["Measured at", new Date(result.measuredAt).toUTCString()],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">{k}</dt>
                  <dd className="break-words">{v}</dd>
                </div>
              ))}
            </dl>
            {result.serverTiming.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold">Server-Timing reported by the site</h3>
                <ul className="mt-1 space-y-0.5 font-mono text-xs">
                  {result.serverTiming.map((t, i) => (
                    <li key={i}>
                      {t.name}
                      {t.durMs !== null && `: ${t.durMs} ms`}
                      {t.desc && ` (${t.desc})`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
