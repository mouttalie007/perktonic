"use client";

import { useEffect, useId, useRef, useState } from "react";
import { crawlCsv, summaryText } from "./logic/report";
import { DEFAULT_OPTIONS, LIMITS, RATE_LIMIT, type CrawlEvent, type CrawlResult, type Item, type Options } from "./logic/types";
import { normalizeStart } from "./logic/url";
import { EXAMPLE_URL } from "../fixtures/examples";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/broken-link-checker";

type Progress = Extract<CrawlEvent, { type: "progress" }>;

const short = (url: string, origin: string) => (url.startsWith(origin) ? url.slice(origin.length) || "/" : url);

function Table({ title, items, origin, empty, uid, show }: { title: string; items: Item[]; origin: string; empty: string; uid: string; show: "status" | "redirect" }) {
  return (
    <section className={card} aria-labelledby={uid}>
      <h2 id={uid} className="text-lg font-semibold">
        {title} <span className="text-sm font-normal text-slate-600">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-green-800">{empty}</p>
      ) : (
        <div className={`relative mt-3 max-h-[28rem] overflow-auto ${focusRing}`} role="region" aria-label={title} tabIndex={0}>
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="sr-only">{title}, with the page each link was found on and its anchor text</caption>
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-xs text-slate-600">
                <th scope="col" className="w-28 py-2 pr-3">
                  {show === "redirect" ? "Status" : "Result"}
                </th>
                <th scope="col" className="py-2 pr-3">
                  Link
                </th>
                <th scope="col" className="py-2">
                  Found on
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.url} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 font-mono text-xs">
                    {i.status ?? "—"}
                    {i.error && <span className="block font-sans text-slate-700">{i.error}</span>}
                  </td>
                  <td className="break-all py-2 pr-3 font-mono text-xs">
                    {short(i.url, origin)}
                    {!i.internal && <span className="ml-1 font-sans text-[11px] text-slate-500">external</span>}
                    {i.redirectTo && <span className="block text-slate-600">→ {short(i.redirectTo, origin)}</span>}
                  </td>
                  <td className="break-all py-2 text-xs">
                    {i.sources.map((s, n) => (
                      <span key={n} className="block">
                        <span className="font-mono">{short(s.page, origin)}</span>
                        {s.text && <span className="text-slate-600"> · “{s.text}”</span>}
                      </span>
                    ))}
                    {i.sourceCount > i.sources.length && <span className="text-slate-500">and {i.sourceCount - i.sources.length} more</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function BrokenLinkCheckerTool() {
  const uid = useId();
  // Kind B: the URL is pre-filled but never crawled automatically.
  const [url, setUrl] = useState(EXAMPLE_URL);
  const [opts, setOpts] = useState<Options>(DEFAULT_OPTIONS);
  const [allowed, setAllowed] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const start = async (target: string, own: boolean) => {
    const check = normalizeStart(target);
    if (!check.ok) {
      setError(check.error);
      setResult(null);
      return;
    }
    if (!own && !allowed) {
      setError("Tick the box to confirm you own this site or are allowed to test it.");
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setError(null);
    setNotice(null);
    setResult(null);
    setProgress(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: check.url, ...opts }), signal: ctrl.signal });
      if (!res.ok || !res.body || !(res.headers.get("content-type") ?? "").includes("ndjson")) {
        const body = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
        throw new Error(body?.error?.message ?? (res.status === 429 ? `You have started ${RATE_LIMIT.limit} crawls in the last 10 minutes. Try again later.` : "The crawler did not answer properly. Please try again."));
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const e = JSON.parse(line) as CrawlEvent;
          if (e.type === "progress") setProgress(e);
          else if (e.type === "done") {
            setResult(e.data);
            setTimeout(() => heading.current?.focus(), 0);
          } else setError(e.message);
        }
      }
    } catch (e) {
      if (ctrl.signal.aborted) {
        setNotice("Crawl cancelled. The server stopped as soon as the connection closed.");
        return;
      }
      setError(e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not reach the crawler. Check your connection and try again.");
    } finally {
      if (abort.current === ctrl) setBusy(false);
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Use the CSV download instead.");
    }
  };

  const save = (text: string, name: string) => {
    const href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  const elapsed = progress ? Math.min(100, Math.round((progress.elapsedMs / LIMITS.ceilingMs) * 100)) : 0;
  const isExample = url.trim() === EXAMPLE_URL;

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Site to check
        </h2>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void start(url, false);
          }}
        >
          <div>
            <label htmlFor={`${uid}-u`} className="block text-sm text-slate-600">
              Start URL
            </label>
            <input id={`${uid}-u`} className={`${inputCls} mt-1 font-mono`} value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} autoCapitalize="off" maxLength={2048} placeholder="https://example.com/" />
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor={`${uid}-depth`} className="block text-sm text-slate-600">
                Depth
              </label>
              <select id={`${uid}-depth`} className={`${inputCls} mt-1`} value={opts.depth} onChange={(e) => setOpts((o) => ({ ...o, depth: Number(e.target.value) }))}>
                <option value={0}>0: this page only</option>
                <option value={1}>1: and pages it links to</option>
                <option value={2}>2: one level further</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-pages`} className="block text-sm text-slate-600">
                Pages to crawl
              </label>
              <select id={`${uid}-pages`} className={`${inputCls} mt-1`} value={opts.maxPages} onChange={(e) => setOpts((o) => ({ ...o, maxPages: Number(e.target.value) }))}>
                {[10, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    up to {n}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={opts.checkExternal} onChange={(e) => setOpts((o) => ({ ...o, checkExternal: e.target.checked }))} />
              Check external links
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={opts.checkImages} onChange={(e) => setOpts((o) => ({ ...o, checkImages: e.target.checked }))} />
              Check images
            </label>
          </div>
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <p>
              <strong>Crawl only sites you own or are authorised to test.</strong> The crawler obeys robots.txt, identifies itself as PerkTonicBot and waits at least 250 ms between requests to a site.
            </p>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" className={`h-4 w-4 accent-primary ${focusRing}`} checked={allowed} onChange={(e) => setAllowed(e.target.checked)} />I own this site or am allowed to test it
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              Start crawl
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={busy}
              onClick={() => {
                setUrl(EXAMPLE_URL);
                void start(EXAMPLE_URL, true);
              }}
            >
              Try an example
            </button>
          </div>
        </form>
        <p className="mt-3 text-xs text-slate-600">
          Limits: depth {LIMITS.maxDepth}, {LIMITS.maxPages} pages, {LIMITS.maxLinks} links and {LIMITS.ceilingMs / 1000} seconds per crawl, {RATE_LIMIT.limit} crawls per 10 minutes.{isExample && " The example crawls perktonic.com, this site."}
        </p>
      </section>

      <div aria-live="polite" className="min-h-6 text-sm text-slate-700">
        {busy && (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {progress ? `${progress.pages} pages crawled · ${progress.checked} links checked · ${progress.problems} problems so far · ${progress.queued} queued` : "Reading robots.txt…"}
              </span>
              <button type="button" className={btnSecondary} onClick={() => abort.current?.abort()}>
                Cancel
              </button>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Time used of the 90-second limit" aria-valuemin={0} aria-valuemax={100} aria-valuenow={elapsed}>
              <div className="h-full bg-primary" style={{ width: `${Math.max(3, elapsed)}%` }} />
            </div>
            {progress?.current && <p className="mt-1 break-all font-mono text-xs text-slate-600">{progress.current}</p>}
          </div>
        )}
        {!busy && notice}
        {!busy && !result && !error && !notice && "Press “Start crawl” to check the site above. Nothing is requested until you do."}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {result && (
        <>
          <section className={card} aria-labelledby={`${uid}-res`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`${uid}-res`} ref={heading} tabIndex={-1} className="break-all text-lg font-semibold outline-none">
                {result.origin.replace(/^https?:\/\//, "")}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnPrimary} onClick={() => save(crawlCsv(result), `broken-links-${new URL(result.origin).hostname}.csv`)}>
                  Download CSV
                </button>
                <button type="button" className={btnSecondary} onClick={() => copy(summaryText(result), "Summary")}>
                  Copy summary
                </button>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ["Broken links", result.broken.length, result.broken.length ? "text-red-800" : "text-green-800"],
                ["Missing images", result.missingImages.length, result.missingImages.length ? "text-red-800" : "text-green-800"],
                ["Redirects", result.redirects.length, "text-amber-900"],
                ["Pages crawled", result.pagesCrawled, ""],
                ["Links checked", result.linksChecked, ""],
              ].map(([k, v, cls]) => (
                <div key={k as string} className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">{k}</dt>
                  <dd className={`text-2xl font-bold tabular-nums ${cls}`}>{v}</dd>
                </div>
              ))}
            </dl>
            {result.stoppedEarly && (
              <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                The crawl stopped early ({result.stoppedEarly === "time" ? "the 90-second limit was reached" : result.stoppedEarly === "links" ? `the limit of ${LIMITS.maxLinks} links was reached` : "it was cancelled"}). The results below cover what was checked until then.
              </p>
            )}
            <p className="mt-3 text-xs text-slate-600">
              robots.txt: {result.robots.status === "found" ? `obeyed${result.robots.crawlDelayMs ? `, with a crawl delay of ${result.robots.crawlDelayMs / 1000} s` : ""}` : "none found, so every page was allowed"}. Skipped: {result.skipped.robots} disallowed by robots.txt, {result.skipped.queryVariants} extra query-string variants, {result.skipped.schemes} mailto/tel/javascript links
              {result.skipped.depth ? `, ${result.skipped.depth} pages beyond the depth limit (checked, not crawled)` : ""}
              {result.skipped.pageLimit ? `, ${result.skipped.pageLimit} pages beyond the page limit (checked, not crawled)` : ""}. Took {(result.durationMs / 1000).toFixed(1)} s.
            </p>
          </section>
          <Table title="Broken links" items={result.broken} origin={result.origin} empty="No broken links found." uid={`${uid}-b`} show="status" />
          <Table title="Missing images" items={result.missingImages} origin={result.origin} empty="Every image loaded." uid={`${uid}-i`} show="status" />
          <Table title="Redirected links" items={result.redirects} origin={result.origin} empty="No redirected links." uid={`${uid}-r`} show="redirect" />
          {result.unknown.length > 0 && <Table title="Could not check" items={result.unknown} origin={result.origin} empty="" uid={`${uid}-u2`} show="status" />}
        </>
      )}
    </div>
  );
}
