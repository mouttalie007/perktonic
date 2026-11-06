"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { EncodingChoice } from "./logic/encoding";
import { MAX_FILE_BYTES, MAX_PASTE_BYTES } from "./logic/input";
import type { Group } from "./logic/report";
import type { LoadedInfo, RunOptions, Side, WorkerRequest, WorkerResponse } from "./worker/compare.worker";
import { SAMPLE_A, SAMPLE_B } from "../fixtures/examples";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

type Compared = Extract<WorkerResponse, { type: "compared" }>;
type Merged = Extract<WorkerResponse, { type: "merged" }>;

const LABEL: Record<Side, string> = { a: "File A (old)", b: "File B (new)" };

function save(text: string, name: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MiniTable({ headers, rows, tone }: { headers: string[]; rows: string[][]; tone: "added" | "removed" | "neutral" }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {headers.map((h, i) => (
              <th key={i} scope="col" className="whitespace-nowrap px-2 py-1.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-t border-slate-200 ${tone === "added" ? "bg-green-50" : tone === "removed" ? "bg-red-50" : "bg-white"}`}>
              {headers.map((_, j) => (
                <td key={j} className="max-w-[14rem] truncate px-2 py-1.5 text-slate-800" title={r[j] ?? ""}>
                  {r[j] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CompareTwoCsvFilesTool() {
  const uid = useId();
  const [texts, setTexts] = useState<Record<Side, string>>({ a: SAMPLE_A, b: SAMPLE_B });
  const [files, setFiles] = useState<Record<Side, File | null>>({ a: null, b: null });
  const [encoding] = useState<EncodingChoice>("auto");
  const [infos, setInfos] = useState<Partial<Record<Side, LoadedInfo>>>({});
  const [options, setOptions] = useState<RunOptions>({ mode: "compare", keys: ["sku"], ignoreCase: true, trim: true, trimValues: false, join: "left" });
  const [compared, setCompared] = useState<Compared | null>(null);
  const [merged, setMerged] = useState<Merged | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ label: string; fraction: number | null } | null>(null);
  const [slow, setSlow] = useState(false);
  const [revive, setRevive] = useState(0);

  const workerRef = useRef<Worker | null>(null);
  const inputs = { a: useRef<HTMLInputElement | null>(null), b: useRef<HTMLInputElement | null>(null) };
  const seq = useRef(0);
  const loadJob = useRef<Record<Side, number>>({ a: -1, b: -1 });
  const runJob = useRef(-1);
  const exportJob = useRef(-1);
  const keysRef = useRef(options.keys);
  /** Job id of the last finished load per side; differs from loadJob while that side is still loading. */
  const doneJob = useRef<Record<Side, number>>({ a: -1, b: -1 });
  const pending = () => doneJob.current.a !== loadJob.current.a || doneJob.current.b !== loadJob.current.b;

  useEffect(() => {
    keysRef.current = options.keys;
  }, [options.keys]);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("./worker/compare.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const m = event.data;
        const isLoad = m.jobId === loadJob.current.a || m.jobId === loadJob.current.b;
        if (!isLoad && m.jobId !== runJob.current && m.jobId !== exportJob.current) return;
        if (m.type === "progress") {
          setBusy({ label: m.label, fraction: m.fraction });
          return;
        }
        if (m.type === "loaded") {
          doneJob.current[m.info.side] = m.jobId;
          setInfos((x) => {
            const next = { ...x, [m.info.side]: m.info };
            // Only once both files are read: keep the chosen keys if both have them, otherwise use the suggestion.
            const has = (info: LoadedInfo | undefined, k: string) => !!info && info.headers.some((h) => h.trim().toLowerCase() === k.trim().toLowerCase());
            if (!pending() && m.suggested.length && !(keysRef.current.length && keysRef.current.every((k) => has(next.a, k) && has(next.b, k)))) {
              setOptions((o) => ({ ...o, keys: m.suggested }));
            }
            return next;
          });
          if (!pending()) setBusy(null);
          return;
        }
        setBusy(null);
        setSlow(false);
        if (m.type === "compared") {
          setCompared(m);
          setMerged(null);
          setError(null);
        } else if (m.type === "merged") {
          setMerged(m);
          setCompared(null);
          setError(null);
        } else if (m.type === "exported") save(m.csv, m.name);
        else {
          setError(m.message);
          if (isLoad) {
            const side: Side = m.jobId === loadJob.current.a ? "a" : "b";
            setInfos((x) => ({ ...x, [side]: undefined }));
          }
          setCompared(null);
          setMerged(null);
        }
      };
      w.onerror = () => {
        setBusy(null);
        setError("The comparison stopped unexpectedly, possibly out of memory. Try smaller files.");
        workerRef.current = null;
        setInfos({});
      };
      workerRef.current = w;
    }
    return workerRef.current;
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const post = useCallback((req: WorkerRequest) => getWorker().postMessage(req), [getWorker]);

  const startTimer = (jobId: number) =>
    setTimeout(() => {
      if (runJob.current === jobId || loadJob.current.a === jobId || loadJob.current.b === jobId) setSlow(true);
    }, 1000);

  // Load a side whenever its text or file changes.
  const loadSide = useCallback(
    (side: Side, text: string, file: File | null) => {
      const jobId = ++seq.current;
      loadJob.current[side] = jobId;
      if (!file && text.trim() === "") {
        setInfos((x) => ({ ...x, [side]: undefined }));
        setCompared(null);
        setMerged(null);
        return;
      }
      if (!file && text.length * 3 > MAX_PASTE_BYTES && new TextEncoder().encode(text).length > MAX_PASTE_BYTES) {
        setError("Pasted text is limited to 5 MB. Open larger data as a file (up to 50 MB).");
        return;
      }
      setBusy({ label: `Reading ${side === "a" ? "file A" : "file B"}`, fraction: null });
      startTimer(jobId);
      post({ type: "load", jobId, side, source: file ? { kind: "file", file } : { kind: "text", text }, encoding });
    },
    [post, encoding],
  );

  useEffect(() => {
    const t = setTimeout(() => loadSide("a", texts.a, files.a), files.a ? 0 : 300);
    return () => clearTimeout(t);
  }, [texts.a, files.a, revive, loadSide]);
  useEffect(() => {
    const t = setTimeout(() => loadSide("b", texts.b, files.b), files.b ? 0 : 300);
    return () => clearTimeout(t);
  }, [texts.b, files.b, revive, loadSide]);

  // Compare or merge whenever both files are loaded or an option changes.
  useEffect(() => {
    if (!infos.a || !infos.b || pending()) return;
    const t = setTimeout(() => {
      const jobId = ++seq.current;
      runJob.current = jobId;
      setBusy({ label: options.mode === "compare" ? "Comparing" : "Merging", fraction: null });
      startTimer(jobId);
      post({ type: "run", jobId, options });
    }, 150);
    return () => clearTimeout(t);
  }, [infos.a, infos.b, options, post]);

  const cancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    runJob.current = loadJob.current.a = loadJob.current.b = ++seq.current;
    setInfos({});
    setBusy(null);
    setSlow(false);
    setCompared(null);
    setMerged(null);
    setError("Stopped. Press “Start again” to reload both files.");
  };

  const onFile = (side: Side, f: File | null) => {
    if (!f) return;
    if (inputs[side].current) inputs[side].current.value = "";
    if (f.size > MAX_FILE_BYTES) {
      setError(`${LABEL[side]} is ${(f.size / 1048576).toFixed(1)} MB. The limit is 50 MB per file.`);
      return;
    }
    setError(null);
    setFiles((x) => ({ ...x, [side]: f }));
    setTexts((x) => ({ ...x, [side]: "" }));
  };

  const exportGroup = useCallback(
    (group: Group | "merged") => {
      const jobId = ++seq.current;
      exportJob.current = jobId;
      post({ type: "export", jobId, group });
    },
    [post],
  );

  const common = infos.a && infos.b ? infos.a.headers.filter((h) => infos.b!.headers.some((x) => x.trim().toLowerCase() === h.trim().toLowerCase())) : [];
  const set = <K extends keyof RunOptions>(key: K, value: RunOptions[K]) => setOptions((o) => ({ ...o, [key]: value }));
  const toggleKey = (k: string) => set("keys", options.keys.includes(k) ? options.keys.filter((x) => x !== k) : [...options.keys, k]);

  // Kept apart from the rest of the page, so progress updates do not re-render tables of up to 200 rows.
  const results = useMemo(
    () => (
      <div aria-live="polite" className="space-y-6">
        {compared && (
          <section className={card} aria-labelledby={`${uid}-res`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`${uid}-res`} className="text-lg font-semibold text-navy">
                Differences <span className="text-sm font-normal text-slate-600">· {compared.ms.toLocaleString("en-US")} ms</span>
              </h2>
              <button type="button" className={btnPrimary} onClick={() => exportGroup("report")}>
                Download full report
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {(
                [
                  ["Added", compared.counts.added, "bg-green-50 text-green-900"],
                  ["Removed", compared.counts.removed, "bg-red-50 text-red-900"],
                  ["Changed", compared.counts.changed, "bg-amber-50 text-amber-900"],
                  ["Unchanged", compared.counts.unchanged, "bg-slate-50 text-slate-800"],
                ] as const
              ).map(([label, n, cls]) => (
                <div key={label} className={`rounded-xl p-3 ${cls}`}>
                  <dt className="text-xs">{label}</dt>
                  <dd className="text-xl font-semibold">{n.toLocaleString("en-US")}</dd>
                </div>
              ))}
            </dl>
            {(compared.columns.onlyA.length > 0 || compared.columns.onlyB.length > 0) && (
              <p className="mt-3 text-sm text-slate-700">
                {compared.columns.onlyB.length > 0 && <>Columns only in B: {compared.columns.onlyB.join(", ")}. </>}
                {compared.columns.onlyA.length > 0 && <>Columns only in A: {compared.columns.onlyA.join(", ")}. </>}
                Only the {compared.columns.common.length} shared columns are compared, matched by name.
              </p>
            )}
            {(compared.duplicates.rowsA > 0 || compared.duplicates.rowsB > 0) && (
              <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                Duplicate keys: {compared.duplicates.rowsA.toLocaleString("en-US")} rows in A and {compared.duplicates.rowsB.toLocaleString("en-US")} rows in B share a key with another row (e.g. “{(compared.duplicates.a[0] ?? compared.duplicates.b[0]).key}”). Rows with the same key are paired in the order they appear; add another key column if that is not right.
              </p>
            )}
            {compared.emptyKeys > 0 && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{compared.emptyKeys.toLocaleString("en-US")} rows have an empty key.</p>}

            {compared.counts.changed > 0 && (
              <div className="mt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-navy">Changed rows</h3>
                  <button type="button" className={`${btnSecondary} text-xs`} onClick={() => exportGroup("changed")}>
                    Download changed (CSV)
                  </button>
                </div>
                <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th scope="col" className="px-2 py-1.5">{compared.keyLabels.join(" + ")}</th>
                        <th scope="col" className="px-2 py-1.5">Changes (old → new)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compared.changed.map((c, i) => (
                        <tr key={i} className="border-t border-slate-200 align-top">
                          <td className="whitespace-nowrap px-2 py-1.5 font-mono text-navy">{c.key.join(" | ")}</td>
                          <td className="px-2 py-1.5">
                            <ul className="space-y-0.5">
                              {c.cells.map((cell) => (
                                <li key={cell.column}>
                                  <span className="font-semibold text-slate-700">{cell.column}:</span> <del className="bg-red-100 px-1 text-red-900">{cell.old || "(empty)"}</del> → <ins className="bg-green-100 px-1 text-green-900 no-underline">{cell.new || "(empty)"}</ins>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {compared.counts.changed > compared.changed.length && <p className="mt-1 text-xs text-slate-500">First {compared.changed.length} of {compared.counts.changed.toLocaleString("en-US")}; download for all of them.</p>}
              </div>
            )}
            {(["added", "removed"] as const).map((g) =>
              compared.counts[g] > 0 ? (
                <div key={g} className="mt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-navy">{g === "added" ? "Added rows (only in B)" : "Removed rows (only in A)"}</h3>
                    <button type="button" className={`${btnSecondary} text-xs`} onClick={() => exportGroup(g)}>
                      Download {g} (CSV)
                    </button>
                  </div>
                  <MiniTable headers={compared[g].headers} rows={compared[g].rows} tone={g} />
                  {compared.counts[g] > compared[g].rows.length && <p className="mt-1 text-xs text-slate-500">First {compared[g].rows.length} of {compared.counts[g].toLocaleString("en-US")}; download for all of them.</p>}
                </div>
              ) : null,
            )}
            {compared.counts.added + compared.counts.removed + compared.counts.changed === 0 && <p className="mt-4 text-sm text-green-800">No differences: every row matches.</p>}
          </section>
        )}

        {merged && (
          <section className={card} aria-labelledby={`${uid}-merged`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`${uid}-merged`} className="text-lg font-semibold text-navy">
                Merged file <span className="text-sm font-normal text-slate-600">· {merged.rowCount.toLocaleString("en-US")} rows · {merged.ms.toLocaleString("en-US")} ms</span>
              </h2>
              <button type="button" className={btnPrimary} onClick={() => exportGroup("merged")}>
                Download merged CSV
              </button>
            </div>
            {merged.multiplied > 0 && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{merged.multiplied.toLocaleString("en-US")} extra rows were created because some keys appear several times in B (every pair is kept, as in SQL).</p>}
            {options.mode === "stack" && <p className="mt-3 text-sm text-slate-700">{merged.removedDuplicates.toLocaleString("en-US")} duplicate rows removed (the first copy is kept, A before B).</p>}
            <MiniTable headers={merged.headers} rows={merged.preview.slice(0, 20)} tone="neutral" />
            {merged.rowCount > 20 && <p className="mt-1 text-xs text-slate-500">First 20 of {merged.rowCount.toLocaleString("en-US")} rows; download for all of them.</p>}
          </section>
        )}
      </div>
    ),
    [compared, merged, options.mode, uid, exportGroup],
  );

  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby={`${uid}-files`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-files`} className="text-lg font-semibold text-navy"><span className="tool-step" aria-hidden>1</span>Two files</h2>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              setFiles({ a: null, b: null });
              setTexts({ a: SAMPLE_A, b: SAMPLE_B });
              setOptions((o) => ({ ...o, keys: ["sku"], ignoreCase: true, trim: true }));
              setRevive((n) => n + 1);
            }}
          >
            Try an example
          </button>
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {(["a", "b"] as const).map((side) => (
            <div key={side}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor={`${uid}-${side}`} className="text-sm font-semibold text-navy">
                  {LABEL[side]}
                </label>
                <div className="flex gap-2">
                  <button type="button" className={`${btnSecondary} px-2 py-1 text-xs`} onClick={() => inputs[side].current?.click()}>
                    Open file
                  </button>
                  <button
                    type="button"
                    className={`${btnSecondary} px-2 py-1 text-xs`}
                    disabled={!files[side] && texts[side] === ""}
                    onClick={() => {
                      setFiles((x) => ({ ...x, [side]: null }));
                      setTexts((x) => ({ ...x, [side]: "" }));
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <input ref={inputs[side]} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFile(side, e.target.files?.[0] ?? null)} />
              {files[side] ? (
                <p id={`${uid}-${side}`} className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  {files[side]!.name} ({(files[side]!.size / 1048576).toFixed(2)} MB)
                </p>
              ) : (
                <textarea id={`${uid}-${side}`} className={`${inputCls} mt-2 h-40 font-mono text-xs`} value={texts[side]} onChange={(e) => setTexts((x) => ({ ...x, [side]: e.target.value }))} spellCheck={false} placeholder="Paste CSV or TSV here, or open a file" />
              )}
              <p className="mt-1 text-xs text-slate-600">{infos[side] ? `${infos[side]!.rowCount.toLocaleString("en-US")} rows, ${infos[side]!.headers.length} columns${infos[side]!.encoding ? `, ${infos[side]!.encoding}` : ""}${infos[side]!.ragged ? `, ${infos[side]!.ragged} rows with a different number of cells` : ""}` : " "}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">CSV or TSV, up to 50 MB per file (5 MB when pasted). Both files stay in your browser. Excel files: save them as CSV first.</p>
      </section>

      <section className={card} aria-labelledby={`${uid}-opt`}>
        <h2 id={`${uid}-opt`} className="text-lg font-semibold text-navy"><span className="tool-step" aria-hidden>2</span>What to do</h2>
        <div role="radiogroup" aria-label="Mode" className="mt-3 inline-flex flex-wrap gap-1 rounded-xl border border-slate-300 bg-white p-1">
          {(
            [
              ["compare", "Compare"],
              ["join", "Merge (join)"],
              ["stack", "Stack and remove duplicates"],
            ] as const
          ).map(([m, label]) => (
            <button key={m} type="button" role="radio" aria-checked={options.mode === m} onClick={() => set("mode", m)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${focusRing} ${options.mode === m ? "bg-primary text-white" : "text-navy hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
        </div>
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-navy">Key columns {options.mode === "stack" ? "(rows with the same key count as duplicates)" : "(identify the same row in both files)"}</legend>
          {common.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">The two files have no column names in common yet.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {common.map((h) => (
                <label key={h} className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${options.keys.some((k) => k.toLowerCase() === h.toLowerCase()) ? "border-primary bg-primary-soft font-semibold text-primary-dark" : "border-slate-300 text-slate-700"}`}>
                  <input type="checkbox" className="sr-only" checked={options.keys.some((k) => k.toLowerCase() === h.toLowerCase())} onChange={() => toggleKey(h)} />
                  {h}
                </label>
              ))}
            </div>
          )}
          {options.keys.length === 0 && options.mode === "compare" && <p className="mt-2 text-sm text-amber-900">No key: rows are compared by position (row 1 with row 1…). This is less reliable: one inserted row makes every following row look changed.</p>}
          {options.keys.length === 0 && options.mode === "stack" && <p className="mt-2 text-sm text-slate-600">No key: rows count as duplicates only when every cell is the same.</p>}
        </fieldset>
        <div className="mt-3 flex flex-col gap-2 text-sm text-slate-700 sm:flex-row sm:flex-wrap sm:gap-6">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className={`h-4 w-4 rounded ${focusRing}`} checked={options.ignoreCase} onChange={(e) => set("ignoreCase", e.target.checked)} />
            Ignore case in keys
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className={`h-4 w-4 rounded ${focusRing}`} checked={options.trim} onChange={(e) => set("trim", e.target.checked)} />
            Ignore spaces around keys
          </label>
          {options.mode === "compare" && (
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className={`h-4 w-4 rounded ${focusRing}`} checked={options.trimValues} onChange={(e) => set("trimValues", e.target.checked)} />
              Ignore spaces around values
            </label>
          )}
        </div>
        {options.mode === "join" && (
          <div className="mt-3 sm:w-72">
            <label htmlFor={`${uid}-join`} className="block text-sm text-slate-600">
              Join type
            </label>
            <select id={`${uid}-join`} className={`${inputCls} mt-1`} value={options.join} onChange={(e) => set("join", e.target.value as RunOptions["join"])}>
              <option value="inner">Inner: only keys in both files</option>
              <option value="left">Left: every row of A (like VLOOKUP)</option>
              <option value="right">Right: every row of B</option>
              <option value="outer">Outer: every row of both</option>
            </select>
          </div>
        )}
      </section>

      <div aria-live="polite" className="min-h-6 text-sm text-slate-700">
        {busy && (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-primary border-t-transparent motion-safe:animate-spin" aria-hidden="true" />
              <span>{busy.label}…</span>
              {slow && (
                <button type="button" className={btnSecondary} onClick={cancel}>
                  Cancel
                </button>
              )}
            </div>
            {busy.fraction !== null && (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(busy.fraction * 100)}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(busy.fraction * 100)}%` }} />
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{error}</p>
          <button
            type="button"
            className={`${btnSecondary} mt-2`}
            onClick={() => {
              setError(null);
              setRevive((n) => n + 1);
            }}
          >
            Start again
          </button>
        </div>
      )}

      {results}
    </div>
  );
}
