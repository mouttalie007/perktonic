"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { analyze, PatternError, type Analysis } from "./logic/explain";
import { jsLiteral, toFlavor } from "./logic/flavors";
import { matchesCsv, segments } from "./logic/match";
import { FLAGS, FLAVORS, MAX_FILE_BYTES, MAX_HIGHLIGHT_CHARS, MAX_MATCHES, MAX_PATTERN_CHARS, MAX_TEXT_BYTES, TIMEOUT_MS, type Flavor } from "./logic/types";
import type { WorkerRequest, WorkerResponse } from "./worker/regex.worker";
import { EXAMPLE, LIBRARY, SLOW } from "../fixtures/library";
import { focusRing, btnSecondary, inputCls, card } from "../../_shared/ui";

const HIGHLIGHT = ["bg-amber-200", "bg-sky-200"];
const SHOWN_MATCHES = 200;

function save(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Done = Extract<WorkerResponse, { ok: true }>;

export default function RegexGeneratorTesterTool() {
  const uid = useId();
  const [pattern, setPattern] = useState(EXAMPLE.pattern);
  const [flags, setFlags] = useState(EXAMPLE.flags);
  const [text, setText] = useState(EXAMPLE.text);
  const [useReplace, setUseReplace] = useState(false);
  const [replacement, setReplacement] = useState("$<level>: $<message>");
  const [flavor, setFlavor] = useState<Flavor>("javascript");
  const [result, setResult] = useState<Done | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [slow, setSlow] = useState(false);
  const [query, setQuery] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const job = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const analysis = useMemo((): { ok: true; value: Analysis } | { ok: false; message: string; index: number } | null => {
    if (pattern.length > MAX_PATTERN_CHARS)
      return {
        ok: false,
        message: `The pattern is ${pattern.length.toLocaleString("en-US")} characters long; the limit is ${MAX_PATTERN_CHARS.toLocaleString("en-US")}.`,
        index: 0,
      };
    try {
      return { ok: true, value: analyze(pattern, flags) };
    } catch (e) {
      if (e instanceof PatternError) return { ok: false, message: e.message, index: e.index };
      return { ok: false, message: (e as Error).message, index: 0 };
    }
  }, [pattern, flags]);

  const flavorResult = useMemo(() => (analysis?.ok ? toFlavor(pattern, flags, analysis.value.features, flavor) : null), [analysis, pattern, flags, flavor]);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("./worker/regex.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const m = event.data;
        if (m.jobId !== job.current) return;
        if (timer.current) clearTimeout(timer.current);
        setRunning(false);
        if (m.ok) {
          setResult(m);
          setRunError(null);
        } else {
          setResult(null);
          setRunError(m.message);
        }
      };
      workerRef.current = w;
    }
    return workerRef.current;
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      workerRef.current?.terminate();
    },
    [],
  );

  // Run the pattern in the worker shortly after each change; stop it if it takes too long.
  useEffect(() => {
    const t = setTimeout(() => {
      const jobId = ++job.current;
      if (timer.current) clearTimeout(timer.current);
      if (!analysis?.ok || pattern === "") {
        setRunning(false);
        setResult(null);
        setRunError(null);
        return;
      }
      const limit = text.length > 1_000_000 ? TIMEOUT_MS * 2 : TIMEOUT_MS;
      const req: WorkerRequest = {
        jobId,
        source: pattern,
        flags,
        text,
        replacement: useReplace ? replacement : null,
      };
      setRunning(true);
      setSlow(false);
      getWorker().postMessage(req);
      // Most runs finish in a few ms; offer Stop only when one lasts long enough to notice.
      setTimeout(() => {
        if (job.current === jobId) setSlow(true);
      }, 300);
      timer.current = setTimeout(() => {
        if (job.current !== jobId) return;
        workerRef.current?.terminate();
        workerRef.current = null;
        setRunning(false);
        setResult(null);
        setRunError(
          `Stopped after ${limit / 1000} second${limit === 1000 ? "" : "s"}. The pattern is probably backtracking catastrophically (for example nested repetition such as (a+)+), or the text is very large. Make the repeated parts unambiguous, anchor the pattern, or test a shorter text.`,
        );
      }, limit);
    }, 200);
    return () => clearTimeout(t);
  }, [analysis, pattern, flags, text, useReplace, replacement, getWorker]);

  const toggleFlag = (f: string) =>
    setFlags((x) =>
      x.includes(f)
        ? x.replace(f, "")
        : FLAGS.map((g) => g.id)
            .filter((g) => x.includes(g) || g === f)
            .join(""),
    );

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      flash(`${what} copied.`);
    } catch {
      flash("Copying was blocked by the browser.");
    }
  };

  const pick = (id: string) => {
    const p = LIBRARY.find((x) => x.id === id);
    if (!p) return;
    setPattern(p.pattern);
    setFlags(p.flags);
    setText(p.test);
    setFileName(null);
    setUseReplace(false);
    setLibraryOpen(false);
  };

  const onFile = async (f: File | null) => {
    if (!f) return;
    if (fileInput.current) fileInput.current.value = "";
    if (f.size > MAX_FILE_BYTES) return flash(`This file is ${(f.size / 1048576).toFixed(1)} MB; the limit is 50 MB.`);
    const head = new Uint8Array(await f.slice(0, 4096).arrayBuffer());
    const utf16 = head[0] === 0xff && head[1] === 0xfe ? "utf-16le" : head[0] === 0xfe && head[1] === 0xff ? "utf-16be" : null;
    const starts = (sig: number[]) => sig.every((b, i) => head[i] === b);
    let refusal: string | null = null;
    if (starts([0x25, 0x50, 0x44, 0x46])) refusal = "This is a PDF. Copy its text and paste it here, or save it as .txt.";
    else if (starts([0x50, 0x4b, 0x03, 0x04])) refusal = "This is a Word, Excel or ZIP file. Save it as plain text (.txt) first.";
    else if (!utf16 && head.includes(0)) refusal = "This file contains binary data, so it is not a text file. Open a .txt, .log, .csv or similar file.";
    if (refusal) {
      setResult(null);
      setRunError(refusal);
      return;
    }
    setText(new TextDecoder(utf16 ?? "utf-8").decode(await f.arrayBuffer()));
    setFileName(f.name);
  };

  const groupNames = analysis?.ok ? analysis.value.groups.map((g) => g.name) : [];
  const matches = result?.matches ?? [];
  const segs = useMemo(() => (result ? segments(text, result.matches, MAX_HIGHLIGHT_CHARS) : []), [result, text]);
  const filtered = LIBRARY.filter((p) => (p.name + " " + p.explanation).toLowerCase().includes(query.trim().toLowerCase()));
  const textBytes = text.length * 3 > MAX_TEXT_BYTES ? new TextEncoder().encode(text).length : text.length;

  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby={`${uid}-p`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-p`} className="text-lg font-semibold text-navy">
            Pattern
          </h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} aria-expanded={libraryOpen} aria-controls={`${uid}-lib`} onClick={() => setLibraryOpen((o) => !o)}>
              Pattern library ({LIBRARY.length})
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => {
                setPattern(EXAMPLE.pattern);
                setFlags(EXAMPLE.flags);
                setText(EXAMPLE.text);
                setFileName(null);
              }}
            >
              Try an example
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => {
                setPattern(SLOW.pattern);
                setFlags(SLOW.flags);
                setText(SLOW.text);
                setFileName(null);
                setUseReplace(false);
              }}
            >
              Try a slow pattern
            </button>
          </div>
        </div>
        {libraryOpen && (
          <div id={`${uid}-lib`} className="mt-3 rounded-xl border border-slate-200 p-3">
            <label htmlFor={`${uid}-q`} className="block text-sm text-slate-600">
              Search the library
            </label>
            <input id={`${uid}-q`} className={`${inputCls} mt-1`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="email, date, phone…" />
            <ul className="mt-3 grid max-h-80 gap-2 overflow-auto sm:grid-cols-2">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button type="button" className={`w-full rounded-xl border border-slate-200 p-3 text-left hover:border-primary hover:bg-primary-soft ${focusRing}`} onClick={() => pick(p.id)}>
                    <span className="block text-sm font-semibold text-navy">{p.name}</span>
                    <span className="mt-1 block break-all font-mono text-xs text-slate-600">{p.pattern.length > 70 ? `${p.pattern.slice(0, 67)}…` : p.pattern}</span>
                    <span className="mt-1 block text-xs text-slate-600">{p.explanation}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className="text-sm text-slate-600">No pattern matches “{query}”.</li>}
            </ul>
          </div>
        )}
        <label htmlFor={`${uid}-pat`} className="mt-3 block text-sm text-slate-600">
          Regular expression (JavaScript syntax, without the surrounding slashes)
        </label>
        <div className="mt-2 flex items-stretch overflow-hidden rounded-xl border border-slate-300 focus-within:ring-2 focus-within:ring-primary">
          <span className="flex items-center bg-slate-50 px-2 font-mono text-slate-500" aria-hidden="true">
            /
          </span>
          <input
            id={`${uid}-pat`}
            className="min-w-0 flex-1 px-2 py-2 font-mono text-sm text-navy outline-none"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            maxLength={MAX_PATTERN_CHARS}
          />
          <span className="flex items-center bg-slate-50 px-2 font-mono text-slate-500" aria-hidden="true">
            /{flags}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Flags">
          {FLAGS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={flags.includes(f.id)}
              title={f.help}
              onClick={() => toggleFlag(f.id)}
              className={`rounded-lg border px-2.5 py-1 font-mono text-sm ${focusRing} ${flags.includes(f.id) ? "border-primary bg-primary text-white" : "border-slate-300 bg-white text-navy"}`}
            >
              {f.label}
              <span className="sr-only">: {f.help}</span>
            </button>
          ))}
          <button type="button" className={`${btnSecondary} ml-auto px-2 py-1 text-xs`} onClick={() => copy(jsLiteral(pattern, flags), "Pattern")} disabled={!analysis?.ok}>
            Copy /pattern/flags
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {FLAGS.filter((f) => flags.includes(f.id))
            .map((f) => `${f.id}: ${f.help}`)
            .join(" · ") || "No flags: only the first match is found, case-sensitive."}
        </p>
      </section>

      <section className={card} aria-labelledby={`${uid}-t`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-t`} className="text-lg font-semibold text-navy">
            Test text
          </h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={() => fileInput.current?.click()}>
              Open a text file
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => {
                setText("");
                setFileName(null);
              }}
              disabled={text === ""}
            >
              Clear text
            </button>
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.log,.csv,.json,.md,.html,.xml,text/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
        <label htmlFor={`${uid}-text`} className="mt-3 block text-sm text-slate-600">
          Text to test against{fileName ? ` (from ${fileName})` : ""}
        </label>
        <textarea
          id={`${uid}-text`}
          className={`${inputCls} mt-2 h-40 font-mono`}
          value={text.length > 200_000 ? text.slice(0, 200_000) : text}
          readOnly={text.length > 200_000}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
        {text.length > 200_000 && (
          <p className="mt-1 text-xs text-slate-600">The box shows the first 200,000 characters of this {(textBytes / 1048576).toFixed(1)} MB text; matching uses all of it.</p>
        )}
        <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className={`h-4 w-4 rounded ${focusRing}`} checked={useReplace} onChange={(e) => setUseReplace(e.target.checked)} />
          Also test a replacement
        </label>
        {useReplace && (
          <div className="mt-2">
            <label htmlFor={`${uid}-rep`} className="block text-sm text-slate-600">
              Replacement ($1, $&lt;name&gt;, $&amp; and $$ work as in JavaScript)
            </label>
            <input id={`${uid}-rep`} className={`${inputCls} mt-1 font-mono`} value={replacement} onChange={(e) => setReplacement(e.target.value)} spellCheck={false} />
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Paste up to 5 MB or open a file up to 50 MB. Matches are highlighted in the first {MAX_HIGHLIGHT_CHARS.toLocaleString("en-US")} characters and listed for the whole text (up to{" "}
          {MAX_MATCHES.toLocaleString("en-US")}). Each run stops after {TIMEOUT_MS / 1000} second (2 for texts over 1 MB). Everything runs in your browser.
        </p>
      </section>

      <div aria-live="polite" className="min-h-6 text-sm text-slate-700">
        {running && (
          <span className="inline-flex flex-wrap items-center gap-3">
            <span className="motion-safe:animate-pulse">Matching…</span>
            {slow && (
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  job.current++;
                  if (timer.current) clearTimeout(timer.current);
                  workerRef.current?.terminate();
                  workerRef.current = null;
                  setRunning(false);
                  setResult(null);
                  setRunError("Stopped. Change the pattern or the text to run it again.");
                }}
              >
                Stop
              </button>
            )}
          </span>
        )}
        {!running && result && (
          <span>
            {result.matches.length.toLocaleString("en-US")}
            {result.capped ? "+" : ""} match
            {result.matches.length === 1 ? "" : "es"} in {result.ms} ms
            {result.capped ? ` (stopped at ${MAX_MATCHES.toLocaleString("en-US")})` : ""}
          </span>
        )}
        {notice && <span className="ml-3">{notice}</span>}
      </div>

      {analysis && !analysis.ok && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>
            <strong>The pattern is not valid:</strong> {analysis.message}
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-white/70 p-2 font-mono text-xs leading-5">{`${pattern.slice(Math.max(0, analysis.index - 40), analysis.index + 40)}\n${" ".repeat(Math.min(analysis.index, 40))}^`}</pre>
        </div>
      )}
      {runError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {runError}
        </div>
      )}

      {analysis?.ok && analysis.value.risks.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Edge-case warning</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {analysis.value.risks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <section className={card} aria-labelledby={`${uid}-m`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`${uid}-m`} className="text-lg font-semibold text-navy">
              Matches
            </h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnSecondary} disabled={!matches.length} onClick={() => copy(matches.map((m) => m.text).join("\n"), "Matches")}>
                Copy matches
              </button>
              <button type="button" className={btnSecondary} disabled={!matches.length} onClick={() => save(matchesCsv(matches, groupNames), "regex-matches.csv", "text/csv;charset=utf-8")}>
                Download CSV
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={!matches.length}
                onClick={() => save(JSON.stringify({ pattern, flags, matches }, null, 2), "regex-matches.json", "application/json")}
              >
                Download JSON
              </button>
            </div>
          </div>
          <div
            className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-navy"
            aria-label="Test text with matches highlighted"
          >
            {segs.map((s, i) =>
              s.match === null ? (
                <span key={i}>{s.text}</span>
              ) : (
                <mark key={i} className={`${HIGHLIGHT[s.match % 2]} rounded-sm text-navy`} title={`Match ${s.match + 1}`}>
                  {s.text}
                </mark>
              ),
            )}
            {text.length > MAX_HIGHLIGHT_CHARS && <span className="text-slate-500">{"\n"}… highlighting stops here; the list below covers the whole text.</span>}
          </div>
          {matches.length === 0 && <p className="mt-3 text-sm text-slate-700">No match. Check the flags (i for case, m for line-by-line ^ and $) and the escapes.</p>}
          {matches.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <caption className="sr-only">Matches and capture groups</caption>
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th scope="col" className="px-2 py-1.5">
                      #
                    </th>
                    <th scope="col" className="px-2 py-1.5">
                      Position
                    </th>
                    <th scope="col" className="px-2 py-1.5">
                      Match
                    </th>
                    {groupNames.map((n, i) => (
                      <th key={i} scope="col" className="px-2 py-1.5">
                        {n ? `${n} (${i + 1})` : `Group ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matches.slice(0, SHOWN_MATCHES).map((m, k) => (
                    <tr key={k} className="border-t border-slate-200 align-top">
                      <td className="px-2 py-1.5 text-slate-500">{k + 1}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-slate-600">
                        {m.index}–{m.end}
                      </td>
                      <td className="max-w-[20rem] break-all px-2 py-1.5 font-mono text-navy">{m.text === "" ? <em className="text-slate-500">empty</em> : m.text}</td>
                      {m.groups.map((g, i) => (
                        <td key={i} className="max-w-[14rem] break-all px-2 py-1.5 font-mono text-slate-700">
                          {g === null ? <em className="text-slate-400">no part</em> : g.text}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {matches.length > SHOWN_MATCHES && (
            <p className="mt-1 text-xs text-slate-500">
              First {SHOWN_MATCHES} of {matches.length.toLocaleString("en-US")} matches; download for all of them.
            </p>
          )}
          {result.replaced !== null && (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-navy">After replacement</h3>
                <button type="button" className={`${btnSecondary} px-2 py-1 text-xs`} onClick={() => copy(result.replaced ?? "", "Replaced text")}>
                  Copy
                </button>
              </div>
              <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-900 p-3 font-mono text-xs text-slate-100">{result.replaced.slice(0, 200_000)}</pre>
            </div>
          )}
        </section>
      )}

      {analysis?.ok && (
        <section className={card} aria-labelledby={`${uid}-e`}>
          <h2 id={`${uid}-e`} className="text-lg font-semibold text-navy">
            What the pattern means
          </h2>
          <ol className="mt-3 space-y-1.5">
            {analysis.value.steps.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm" style={{ paddingLeft: `${s.depth * 1.25}rem` }}>
                {s.raw && (
                  <code className="h-fit shrink-0 break-all rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-navy">
                    {s.raw.trim() === "" ? s.raw.replace(/ /g, "␠") : s.raw.length > 60 ? `${s.raw.slice(0, 57)}…` : s.raw}
                  </code>
                )}
                <span className="text-slate-700">{s.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {flavorResult && (
        <section className={card} aria-labelledby={`${uid}-f`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`${uid}-f`} className="text-lg font-semibold text-navy">
              Use it in another language
            </h2>
            <div className="sm:w-56">
              <label htmlFor={`${uid}-fl`} className="sr-only">
                Regex flavour
              </label>
              <select id={`${uid}-fl`} className={inputCls} value={flavor} onChange={(e) => setFlavor(e.target.value as Flavor)}>
                {FLAVORS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {flavor !== "javascript" && (
            <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
              The live test above runs JavaScript&apos;s engine. This pattern was not run in {FLAVORS.find((f) => f.id === flavor)!.label}; the lists below are the syntax differences we know of.
            </p>
          )}
          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-3 font-mono text-xs text-slate-100">{flavorResult.code}</pre>
          <button type="button" className={`${btnSecondary} mt-2 text-xs`} onClick={() => copy(flavorResult.code, "Code")}>
            Copy code
          </button>
          {flavorResult.problems.length > 0 && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">Will not work as is</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {flavorResult.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {flavorResult.changes.length > 0 && (
            <div className="mt-3 text-sm text-slate-700">
              <p className="font-semibold text-navy">Rewritten for you</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {flavorResult.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {flavorResult.notes.length > 0 && (
            <div className="mt-3 text-sm text-slate-700">
              <p className="font-semibold text-navy">Differences to know</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {flavorResult.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
