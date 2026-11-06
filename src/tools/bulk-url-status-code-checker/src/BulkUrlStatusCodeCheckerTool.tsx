"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { BATCH_SIZE, MAX_PASTE_CHARS, MAX_URLS } from "./logic/limits";
import { checkListFile, chunk, parseList } from "./logic/parse";
import { statusGroup } from "./logic/status";
import { counts, filterRows, sortRows, toCsv, toTsv, type Filter, type Row, type SortKey } from "./logic/table";
import type { CheckResult } from "./logic/types";
import { EXAMPLE_LIST } from "../fixtures/examples";
import { focusRing, btnPrimary, btnSecondary, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/bulk-url-status-code-checker";


const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "2xx", label: "2xx OK" },
  { id: "3xx", label: "3xx" },
  { id: "redirected", label: "Redirected" },
  { id: "4xx", label: "4xx" },
  { id: "5xx", label: "5xx" },
  { id: "error", label: "No response" },
];

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "index", label: "#", className: "w-10" },
  { key: "url", label: "URL" },
  { key: "status", label: "Status" },
  { key: "finalUrl", label: "Final URL" },
  { key: "redirects", label: "Redirects" },
  { key: "timeMs", label: "Time" },
  { key: "contentType", label: "Type" },
];

const BADGE: Record<string, string> = {
  "2xx": "bg-green-100 text-green-800",
  "3xx": "bg-blue-100 text-blue-800",
  "4xx": "bg-amber-100 text-amber-900",
  "5xx": "bg-red-100 text-red-800",
  error: "bg-slate-200 text-slate-800",
};

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileStamp() {
  return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
}

export default function BulkUrlStatusCodeCheckerTool() {
  const uid = useId();
  const [text, setText] = useState("");
  const [followRedirects, setFollowRedirects] = useState(true);
  const [headFirst, setHeadFirst] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "index", dir: "asc" });
  const abortRef = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => parseList(text), [text]);
  const skipped = parsed.items.filter((i) => i.skip);
  const running = progress !== null && progress.done < progress.total;

  useEffect(() => () => abortRef.current?.abort(), []);

  const check = async (source: string) => {
    abortRef.current?.abort();
    const list = parseList(source);
    setError(null);
    setRows([]);
    setFilter("all");
    setQuery("");
    setSort({ key: "index", dir: "asc" });
    if (list.urls.length === 0) {
      setProgress(null);
      setError(source.trim() === "" ? "Paste some URLs first, one per line, or upload a .txt or .csv file." : "None of the lines is a URL that can be checked. See the skipped lines below the box.");
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setProgress({ done: 0, total: list.urls.length });
    const batches = chunk(list.urls, BATCH_SIZE);
    let done = 0;
    for (const batch of batches) {
      if (ctrl.signal.aborted) return;
      let res: Response;
      try {
        res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ urls: batch, followRedirects, headFirst }), signal: ctrl.signal });
      } catch {
        if (ctrl.signal.aborted) return;
        setError(`The connection to our server failed after ${done} of ${list.urls.length} URLs. Check your connection and try again.`);
        setProgress(null);
        return;
      }
      let body: { ok: true; data: { results: CheckResult[] } } | { ok: false; error: { message: string } } | null = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      if (ctrl.signal.aborted) return;
      if (!body || !body.ok) {
        const msg = body && !body.ok ? body.error.message : `Our server answered with an error (HTTP ${res.status}).`;
        setError(done > 0 ? `${msg} The ${done} URLs checked so far are shown below.` : msg);
        setProgress(null);
        return;
      }
      const start = done;
      setRows((prev) => [...prev, ...body.data.results.map((r, i) => ({ ...r, index: start + i + 1 }))]);
      done += batch.length;
      setProgress({ done, total: list.urls.length });
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setProgress((p) => (p ? { done: p.total, total: p.total } : p));
    setNotice("Stopped. The URLs checked before you pressed Cancel are kept.");
    setTimeout(() => setNotice(null), 4000);
  };

  const onFile = async (f: File | null) => {
    if (!f) return;
    const head = new Uint8Array(await f.slice(0, 1024).arrayBuffer());
    const problem = checkListFile(head, f.size, f.name);
    if (fileInput.current) fileInput.current.value = "";
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setText((await f.text()).slice(0, MAX_PASTE_CHARS));
  };

  const shown = useMemo(() => sortRows(filterRows(rows, filter, query), sort.key, sort.dir), [rows, filter, query, sort]);
  const tally = counts(rows);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toTsv(shown));
      setNotice(`Copied ${shown.length} row${shown.length === 1 ? "" : "s"}; paste them into a spreadsheet.`);
    } catch {
      setNotice("Copying was blocked by the browser. Use Download CSV instead.");
    }
    setTimeout(() => setNotice(null), 3000);
  };

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "timeMs" || key === "redirects" ? "desc" : "asc" }));

  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-in`} className="text-lg font-semibold text-navy">URLs to check</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={running}
              onClick={() => {
                setText(EXAMPLE_LIST);
                void check(EXAMPLE_LIST);
              }}
            >
              Try an example
            </button>
            <button type="button" className={btnSecondary} disabled={running} onClick={() => fileInput.current?.click()}>
              Upload .txt or .csv
            </button>
          </div>
        </div>
        <input ref={fileInput} type="file" accept=".txt,.csv,text/plain,text/csv" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
        <label htmlFor={`${uid}-list`} className="mt-3 block text-sm text-slate-600">
          One URL per line, or a CSV with or without a header (the URL column is found automatically)
        </label>
        <textarea
          id={`${uid}-list`}
          className={`mt-2 h-48 w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-sm text-navy ${focusRing}`}
          value={text}
          maxLength={MAX_PASTE_CHARS}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={"https://example.com/\nhttps://example.com/pricing\nexample.com/old-page"}
        />
        <p className="mt-2 text-sm text-slate-700" aria-live="polite">
          {text.trim() === "" ? (
            `Up to ${MAX_URLS} URLs per check. Duplicates and lines that are not URLs are skipped.`
          ) : (
            <>
              {parsed.urls.length} URL{parsed.urls.length === 1 ? "" : "s"} to check · {parsed.format}
              {skipped.length > 0 && ` · ${skipped.length} line${skipped.length === 1 ? "" : "s"} skipped`}
            </>
          )}
        </p>
        {skipped.length > 0 && (
          <details className="mt-2 text-sm text-slate-700">
            <summary className={`cursor-pointer rounded font-semibold text-navy ${focusRing}`}>Skipped lines</summary>
            <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
              {skipped.map((i) => (
                <li key={i.line} className="break-words">
                  Line {i.line}: <code className="break-all font-mono text-xs">{i.raw.length > 120 ? `${i.raw.slice(0, 117)}…` : i.raw}</code>: {i.note}
                </li>
              ))}
            </ul>
          </details>
        )}

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-navy">Options</legend>
          <div className="mt-2 flex flex-col gap-2 text-sm text-slate-700 sm:flex-row sm:gap-6">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className={`h-4 w-4 rounded ${focusRing}`} checked={followRedirects} onChange={(e) => setFollowRedirects(e.target.checked)} />
              Follow redirects (up to 10)
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className={`h-4 w-4 rounded ${focusRing}`} checked={headFirst} onChange={(e) => setHeadFirst(e.target.checked)} />
              Try HEAD first (faster; GET is used when HEAD is refused)
            </label>
          </div>
        </fieldset>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className={btnPrimary} disabled={running || text.trim() === ""} onClick={() => void check(text)}>
            Check {parsed.urls.length > 0 ? `${parsed.urls.length} URL${parsed.urls.length === 1 ? "" : "s"}` : "URLs"}
          </button>
          {running && (
            <button type="button" className={btnSecondary} onClick={cancel}>
              Cancel
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Only check URLs you are allowed to test. Our server requests each URL (one request at a time per site, at least 0.25 s apart), with a 10-second timeout per request. Private and internal addresses are refused.
        </p>
      </section>

      <div aria-live="polite" className="min-h-6">
        {progress && running && (
          <div>
            <div className="flex justify-between text-sm text-slate-700">
              <span>Checking… {progress.done} of {progress.total} done</span>
              <span>{Math.round((progress.done / progress.total) * 100)}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="URLs checked" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
              <div className="h-full rounded-full bg-primary motion-safe:transition-all" style={{ width: `${Math.max(4, (progress.done / progress.total) * 100)}%` }} />
            </div>
          </div>
        )}
        {notice && <p className="mt-2 text-sm text-slate-700">{notice}</p>}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {rows.length > 0 && (
        <section className={card} aria-labelledby={`${uid}-res`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`${uid}-res`} className="text-lg font-semibold text-navy">
              Results <span className="text-sm font-normal text-slate-600">· {rows.length} checked</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnSecondary} onClick={copy}>
                Copy table
              </button>
              <button type="button" className={btnPrimary} onClick={() => download(toCsv(shown), `url-status-${fileStamp()}.csv`)}>
                Download CSV
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                disabled={f.id !== "all" && tally[f.id] === 0}
                onClick={() => setFilter(f.id)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${focusRing} ${filter === f.id ? "border-primary bg-primary text-white" : "border-slate-300 bg-white text-navy hover:bg-slate-50"}`}
              >
                {f.label} ({tally[f.id]})
              </button>
            ))}
          </div>
          <label htmlFor={`${uid}-q`} className="sr-only">
            Search the results
          </label>
          <input
            id={`${uid}-q`}
            type="search"
            className={`mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:w-72 ${focusRing}`}
            placeholder="Search URL, status or type"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <caption className="sr-only">Status of each URL. Column headers sort the table.</caption>
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c.key} scope="col" className={`px-3 py-2 font-semibold ${c.className ?? ""}`} aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                      <button type="button" className={`inline-flex items-center gap-1 rounded ${focusRing}`} onClick={() => toggleSort(c.key)}>
                        {c.label}
                        <span aria-hidden="true">{sort.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const group = statusGroup(r.status);
                  return (
                    <tr key={r.index} className="border-t border-slate-200 align-top">
                      <td className="px-3 py-2 text-slate-500">{r.index}</td>
                      <td className="max-w-[18rem] break-all px-3 py-2 font-mono text-xs text-navy">{r.url}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block whitespace-nowrap rounded-lg px-2 py-0.5 text-xs font-semibold ${BADGE[group]}`}>{r.status ?? "—"} {r.statusText}</span>
                        {r.error && <p className="mt-1 max-w-[16rem] text-xs text-red-800">{r.error.message}</p>}
                        {r.method === "GET" && headFirst && !r.error && <p className="mt-1 text-xs text-slate-500">via GET</p>}
                      </td>
                      <td className="max-w-[18rem] break-all px-3 py-2 font-mono text-xs text-slate-700">{r.finalUrl && r.finalUrl !== r.url ? r.finalUrl : r.finalUrl ? "same" : "—"}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {r.redirects > 0 ? (
                          <>
                            {r.redirects} <span className="text-xs text-slate-500">({r.chain.join(" → ")})</span>
                          </>
                        ) : r.status !== null && r.status >= 300 && r.status < 400 ? (
                          <span className="text-xs text-slate-500">not followed</span>
                        ) : (
                          0
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">{r.timeMs.toLocaleString("en-US")} ms</td>
                      <td className="px-3 py-2 text-xs text-slate-700">{r.contentType ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {shown.length === 0 && <p className="p-4 text-sm text-slate-600">No rows match this filter.</p>}
          </div>
          <p className="mt-2 text-xs text-slate-500">Copy and Download include the rows shown with the current filter and order.</p>
        </section>
      )}
    </div>
  );
}
