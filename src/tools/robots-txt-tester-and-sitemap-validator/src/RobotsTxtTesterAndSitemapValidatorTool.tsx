"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CRAWLERS, MAX_SITEMAP_FILES, MAX_TEST_URLS, MAX_URL_LENGTH, MAX_USER_AGENTS } from "./logic/limits";
import type { Issue, Verdict } from "./logic/robots";
import type { CheckData, SitemapReport } from "./logic/types";
import type { WorkerRequest, WorkerResponse } from "./worker/test.worker";
import { EXAMPLE } from "../fixtures/examples";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/robots-txt-tester-and-sitemap-validator";


const SEVERITY: Record<Issue["severity"], { label: string; cls: string }> = {
  error: { label: "Error", cls: "bg-red-100 text-red-800" },
  warning: { label: "Warning", cls: "bg-amber-100 text-amber-900" },
  info: { label: "Note", cls: "bg-slate-100 text-slate-700" },
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function IssueList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2">
      {issues.map((i, k) => (
        <li key={k} className="flex gap-2 text-sm text-slate-700">
          <span className={`mt-0.5 inline-block h-fit shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold ${SEVERITY[i.severity].cls}`}>{SEVERITY[i.severity].label}</span>
          <span>
            {i.line !== null && <span className="font-mono text-xs text-slate-500">line {i.line}: </span>}
            {i.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

function summaryText(data: CheckData, verdicts: { url: string; ua: string; v: Verdict }[]): string {
  const lines = [`robots.txt and sitemap report for ${data.origin}`, "", `robots.txt: ${data.robots.message}`];
  for (const i of data.robots.parsed.issues) lines.push(`  - ${i.severity}${i.line ? ` (line ${i.line})` : ""}: ${i.message}`);
  if (verdicts.length) {
    lines.push("", "URL tests:");
    for (const t of verdicts) lines.push(`  - ${t.v.allowed ? "ALLOWED" : "BLOCKED"} ${t.url} for ${t.ua}: ${t.v.explanation}`);
  }
  lines.push("", "Sitemaps:");
  for (const s of data.sitemaps) {
    lines.push(`  ${s.url} (${s.status ?? "no answer"}, ${s.kind === "sitemapindex" ? `index of ${s.entryCount} sitemaps` : `${s.entryCount} URLs`})`);
    for (const i of s.issues) lines.push(`    - ${i.severity}: ${i.message}`);
  }
  for (const n of data.notChecked) lines.push(`  Not checked: ${n.url}: ${n.reason}`);
  return lines.join("\n");
}

function SitemapCard({ s }: { s: SitemapReport }) {
  const worst = s.issues.some((i) => i.severity === "error") ? "error" : s.issues.some((i) => i.severity === "warning") ? "warning" : "ok";
  const badge = worst === "error" ? "bg-red-100 text-red-800" : worst === "warning" ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-800";
  const source = s.source === "robots" ? "listed in robots.txt" : s.source === "default" ? "default location" : "from the sitemap index";
  return (
    <li className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 break-all font-mono text-sm text-navy">{s.url}</p>
        <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${badge}`}>{worst === "error" ? "Problems" : worst === "warning" ? "Warnings" : "OK"}</span>
      </div>
      <p className="mt-1 text-xs text-slate-600">
        {source}
        {s.status !== null && ` · HTTP ${s.status}`}
        {s.kind !== "unknown" && ` · ${s.kind === "sitemapindex" ? `sitemap index, ${s.entryCount.toLocaleString("en-US")} sitemaps` : `${s.entryCount.toLocaleString("en-US")} URLs${s.partial ? " (first 2 MB)" : ""}`}`}
        {s.bytes > 0 && ` · ${fmtBytes(s.bytes)}${s.gzipped && s.unpackedBytes ? ` gzipped, ${fmtBytes(s.unpackedBytes)} unpacked` : ""}`}
        {s.finalUrl && s.finalUrl !== s.url && ` · redirects to ${s.finalUrl}`}
      </p>
      {s.kind !== "unknown" && s.entryCount > 0 && (
        <p className="mt-1 text-xs text-slate-600">
          lastmod: {s.lastmod.valid.toLocaleString("en-US")} valid, {s.lastmod.invalid} invalid, {s.lastmod.future} in the future, {s.lastmod.missing.toLocaleString("en-US")} missing
          {s.lastmod.newest && ` · newest ${s.lastmod.newest}`}
          {s.kind === "urlset" && ` · ${s.blockedForGooglebot.toLocaleString("en-US")} blocked for Googlebot`}
        </p>
      )}
      <IssueList issues={s.issues} />
      {(s.sampleEntries.length > 0 || s.blockedExamples.length > 0) && (
        <details className="mt-2 text-xs text-slate-700">
          <summary className={`cursor-pointer rounded font-semibold text-navy ${focusRing}`}>Examples</summary>
          {s.sampleEntries.length > 0 && <p className="mt-1 font-semibold">First {s.sampleEntries.length} entries</p>}
          <ul className="mt-1 space-y-0.5 font-mono">
            {s.sampleEntries.map((u) => (
              <li key={u} className="break-all">{u}</li>
            ))}
          </ul>
          {s.blockedExamples.length > 0 && (
            <>
              <p className="mt-2 font-semibold">Blocked for Googlebot</p>
              <ul className="mt-1 space-y-0.5 font-mono">
                {s.blockedExamples.map((u) => (
                  <li key={u} className="break-all">{u}</li>
                ))}
              </ul>
            </>
          )}
        </details>
      )}
    </li>
  );
}

export default function RobotsTxtTesterAndSitemapValidatorTool() {
  const uid = useId();
  const [domain, setDomain] = useState(EXAMPLE.domain);
  const [testUrls, setTestUrls] = useState("");
  const [agents, setAgents] = useState<string[]>(["Googlebot"]);
  const [custom, setCustom] = useState("");
  const [data, setData] = useState<CheckData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const urlList = useMemo(() => testUrls.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, MAX_TEST_URLS), [testUrls]);
  const customAgent = custom.trim();
  const allAgents = useMemo(() => [...agents, ...(customAgent && !agents.includes(customAgent) ? [customAgent] : [])].slice(0, MAX_USER_AGENTS), [agents, customAgent]);
  const [verdicts, setVerdicts] = useState<WorkerResponse["verdicts"]>([]);
  const [testError, setTestError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const jobRef = useRef(0);
  const loadedRef = useRef<CheckData | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  // Tested in a worker against the file already loaded, so changing URLs or crawlers costs no request.
  useEffect(() => {
    const t = setTimeout(() => {
      const jobId = ++jobRef.current;
      if (!data || urlList.length === 0 || allAgents.length === 0) {
        setVerdicts([]);
        setTestError(null);
        return;
      }
      if (!workerRef.current) {
        const w = new Worker(new URL("./worker/test.worker.ts", import.meta.url), { type: "module" });
        w.onmessage = (e: MessageEvent<WorkerResponse>) => {
          if (e.data.jobId !== jobRef.current) return;
          if (watchdogRef.current) clearTimeout(watchdogRef.current);
          setVerdicts(e.data.verdicts);
          setTestError(null);
        };
        workerRef.current = w;
        loadedRef.current = null;
      }
      const w = workerRef.current;
      if (loadedRef.current !== data) {
        w.postMessage({ type: "load", text: data.robots.text, state: data.robots.state } satisfies WorkerRequest);
        loadedRef.current = data;
      }
      w.postMessage({ type: "test", jobId, urls: urlList, userAgents: allAgents } satisfies WorkerRequest);
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      watchdogRef.current = setTimeout(() => {
        if (jobRef.current !== jobId) return;
        w.terminate();
        workerRef.current = null;
        setVerdicts([]);
        setTestError("Testing took longer than 2 seconds and was stopped. This robots.txt has an unusually large number of rules; try fewer URLs or crawlers.");
      }, 2000);
    }, 150);
    return () => clearTimeout(t);
  }, [data, urlList, allAgents]);

  const check = async (site: string, urls: string[], uas: string[]) => {
    abortRef.current?.abort();
    if (site.trim() === "") {
      setError("Enter a domain, for example example.com.");
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setSlow(false);
    setError(null);
    setData(null);
    const timer = setTimeout(() => setSlow(true), 1000);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ domain: site, urls, userAgents: uas }), signal: ctrl.signal });
      const body = (await res.json().catch(() => null)) as { ok: true; data: CheckData } | { ok: false; error: { message: string } } | null;
      if (!body) setError(`Our server answered with an error (HTTP ${res.status}). Please try again.`);
      else if (!body.ok) setError(body.error.message);
      else setData(body.data);
    } catch {
      if (!ctrl.signal.aborted) setError("The connection to our server failed. Check your connection and try again.");
    } finally {
      clearTimeout(timer);
      if (abortRef.current === ctrl) {
        setLoading(false);
        setSlow(false);
      }
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setLoading(false);
    setSlow(false);
    setError("Check cancelled.");
  };

  const toggleAgent = (a: string) => setAgents((list) => (list.includes(a) ? list.filter((x) => x !== a) : list.length >= MAX_USER_AGENTS ? list : [...list, a]));

  const tryExample = () => {
    setDomain(EXAMPLE.domain);
    setTestUrls(EXAMPLE.urls.join("\n"));
    setAgents(EXAMPLE.userAgents);
    setCustom("");
    void check(EXAMPLE.domain, EXAMPLE.urls, EXAMPLE.userAgents);
  };

  const copySummary = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(summaryText(data, verdicts));
      setNotice("Report copied as text.");
    } catch {
      setNotice("Copying was blocked by the browser. Use Download report instead.");
    }
    setTimeout(() => setNotice(null), 3000);
  };

  const allIssues = data ? [data.robots.parsed.issues, ...data.sitemaps.map((s) => s.issues)].flat() : [];
  const robotsLines = data?.robots.text ? data.robots.text.split(/\r\n|\r|\n/) : [];

  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-in`} className="text-lg font-semibold text-navy">Site to check</h2>
          <button type="button" className={btnSecondary} onClick={tryExample} disabled={loading}>
            Try an example
          </button>
        </div>
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void check(domain, urlList, allAgents);
          }}
        >
          <label htmlFor={`${uid}-domain`} className="block text-sm text-slate-600">
            Domain or any URL on the site
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input id={`${uid}-domain`} className={inputCls} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" maxLength={MAX_URL_LENGTH} autoCapitalize="off" autoCorrect="off" spellCheck={false} inputMode="url" />
            <button type="submit" className={`${btnPrimary} shrink-0`} disabled={loading}>
              Check robots.txt and sitemaps
            </button>
          </div>
        </form>
        <label htmlFor={`${uid}-urls`} className="mt-4 block text-sm text-slate-600">
          URLs or paths to test (optional, one per line, up to {MAX_TEST_URLS})
        </label>
        <textarea id={`${uid}-urls`} className={`${inputCls} mt-2 h-24 font-mono`} value={testUrls} onChange={(e) => setTestUrls(e.target.value)} placeholder={"/checkout/\nhttps://example.com/blog/post?sort=new"} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
        <fieldset className="mt-3">
          <legend className="text-sm text-slate-600">Crawlers to test (up to {MAX_USER_AGENTS})</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CRAWLERS.map((a) => (
              <label key={a} className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${agents.includes(a) ? "border-primary bg-primary-soft font-semibold text-primary-dark" : "border-slate-300 text-slate-700"}`}>
                <input type="checkbox" className="sr-only" checked={agents.includes(a)} onChange={() => toggleAgent(a)} />
                {a === "*" ? "* (any other crawler)" : a}
              </label>
            ))}
          </div>
          <label htmlFor={`${uid}-ua`} className="mt-3 block text-xs text-slate-600">
            Other crawler name (optional)
          </label>
          <input id={`${uid}-ua`} className={`${inputCls} mt-1 sm:w-64`} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. AhrefsBot" maxLength={100} />
        </fieldset>
        <p className="mt-3 text-xs text-slate-500">
          Our server fetches /robots.txt, the sitemaps it lists and /sitemap.xml, following a sitemap index one level, up to {MAX_SITEMAP_FILES} sitemap files of 2 MB each (.xml.gz is unpacked). Only sitemaps on the same domain are fetched. 10 checks per 10 minutes; testing more URLs against a loaded robots.txt is free and instant.
        </p>
      </section>

      <div aria-live="polite" className="min-h-6 text-sm text-slate-700">
        {loading && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-primary border-t-transparent motion-safe:animate-spin" aria-hidden="true" />
            <span>Fetching robots.txt and sitemaps…</span>
            {slow && (
              <button type="button" className={btnSecondary} onClick={cancel}>
                Cancel
              </button>
            )}
          </div>
        )}
        {notice && <p>{notice}</p>}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div aria-live="polite" className="space-y-6">
        {data && (
          <>
            <section className={card} aria-labelledby={`${uid}-sum`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id={`${uid}-sum`} className="text-lg font-semibold text-navy">
                  Report for <span className="break-all">{data.origin}</span>
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnSecondary} onClick={copySummary}>
                    Copy report
                  </button>
                  <button type="button" className={btnPrimary} onClick={() => download(JSON.stringify({ ...data, tests: verdicts.map((t) => ({ url: t.url, userAgent: t.ua, ...t.v })) }, null, 2), `${new URL(data.origin).hostname}-robots-sitemap-report.json`, "application/json")}>
                    Download report
                  </button>
                </div>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs text-slate-600">robots.txt</dt>
                  <dd className="mt-1 font-semibold text-navy">{data.robots.state === "found" ? `Found (HTTP ${data.robots.status})` : data.robots.state === "missing" ? "Not found" : "Could not be read"}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs text-slate-600">Sitemap files checked</dt>
                  <dd className="mt-1 font-semibold text-navy">
                    {data.sitemaps.length} · {data.sitemaps.filter((s) => s.kind === "urlset").reduce((n, s) => n + s.entryCount, 0).toLocaleString("en-US")} URLs
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs text-slate-600">Problems</dt>
                  <dd className="mt-1 font-semibold text-navy">
                    {plural(allIssues.filter((i) => i.severity === "error").length, "error")} · {plural(allIssues.filter((i) => i.severity === "warning").length, "warning")}
                  </dd>
                </div>
              </dl>
            </section>

            {testError && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {testError}
              </div>
            )}
            {verdicts.length > 0 && (
              <section className={card} aria-labelledby={`${uid}-tests`}>
                <h2 id={`${uid}-tests`} className="text-lg font-semibold text-navy">Allowed or blocked?</h2>
                <p className="mt-1 text-xs text-slate-500">Edit the URLs or crawlers above and these results update instantly, using the robots.txt already loaded.</p>
                <ul className="mt-3 divide-y divide-slate-200">
                  {verdicts.map((t) => (
                    <li key={`${t.url}|${t.ua}`} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:gap-3">
                      <span className={`w-fit shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold ${t.v.allowed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{t.v.allowed ? "Allowed" : "Blocked"}</span>
                      <div className="min-w-0 text-sm">
                        <p className="break-all font-mono text-xs text-navy">
                          {t.url} <span className="font-sans text-slate-500">for {t.ua}</span>
                        </p>
                        <p className="text-slate-700">{t.v.explanation}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className={card} aria-labelledby={`${uid}-robots`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id={`${uid}-robots`} className="text-lg font-semibold text-navy">robots.txt</h2>
                {data.robots.text && (
                  <button type="button" className={btnSecondary} onClick={() => download(data.robots.text, "robots.txt", "text/plain;charset=utf-8")}>
                    Download robots.txt
                  </button>
                )}
              </div>
              <p className="mt-1 break-all text-sm text-slate-700">
                <span className="font-mono text-xs">{data.robots.finalUrl ?? data.robots.url}</span> · {data.robots.message}
              </p>
              <IssueList issues={data.robots.parsed.issues} />
              {data.robots.parsed.groups.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                    <caption className="sr-only">Groups in robots.txt</caption>
                    <thead className="bg-slate-50 text-xs text-slate-600">
                      <tr>
                        <th scope="col" className="px-3 py-2">User-agent</th>
                        <th scope="col" className="px-3 py-2">Rules</th>
                        <th scope="col" className="px-3 py-2">Crawl-delay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.robots.parsed.groups.map((g) => (
                        <tr key={g.line} className="border-t border-slate-200 align-top">
                          <td className="px-3 py-2 font-mono text-xs">{g.agents.join(", ")}</td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {g.rules.length === 0 ? <span className="font-sans text-slate-500">none</span> : g.rules.map((r) => (
                              <div key={r.line} className={r.type === "allow" ? "text-green-800" : "text-red-800"}>
                                {r.type === "allow" ? "Allow" : "Disallow"}: {r.path}
                              </div>
                            ))}
                          </td>
                          <td className="px-3 py-2 text-xs">{g.crawlDelay ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {robotsLines.length > 0 && (
                <details className="mt-4">
                  <summary className={`cursor-pointer rounded text-sm font-semibold text-navy ${focusRing}`}>The file ({robotsLines.length} lines)</summary>
                  <pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-xs leading-5 text-slate-100">
                    {robotsLines.slice(0, 2000).map((l, i) => `${String(i + 1).padStart(4, " ")}  ${l}`).join("\n")}
                    {robotsLines.length > 2000 && `\n… ${robotsLines.length - 2000} more lines (download the file to see them)`}
                  </pre>
                </details>
              )}
            </section>

            <section className={card} aria-labelledby={`${uid}-sm`}>
              <h2 id={`${uid}-sm`} className="text-lg font-semibold text-navy">Sitemaps</h2>
              {data.sitemaps.length === 0 && <p className="mt-2 text-sm text-slate-700">No sitemap was found on this domain.</p>}
              <ul className="mt-3 space-y-3">
                {data.sitemaps.map((s) => (
                  <SitemapCard key={s.url} s={s} />
                ))}
              </ul>
              {data.notChecked.length > 0 && (
                <div className="mt-4 text-sm text-slate-700">
                  <h3 className="font-semibold text-navy">Not checked</h3>
                  <ul className="mt-1 space-y-1">
                    {data.notChecked.map((n) => (
                      <li key={n.url} className="break-words">
                        <span className="break-all font-mono text-xs">{n.url}</span>: {n.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
