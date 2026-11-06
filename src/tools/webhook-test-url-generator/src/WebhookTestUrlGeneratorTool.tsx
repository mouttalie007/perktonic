"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SAMPLE_ENDPOINT, SAMPLE_URL } from "../fixtures/sample";
import { ACTIONS_PATH, EVENTS_PATH, HOOK_PATH, MAX_ACTIVE_PER_IP, MAX_BODY_BYTES, MAX_DELAY_MS, MAX_REQUESTS, POLL_MS, PUBLIC_NOTE, REPLY_TYPES, TTL_MINUTES, type ReplyType } from "./limits";
import { toCurl } from "./logic/curl";
import { base64ToBytes, formatBytes, hexDump, pretty } from "./logic/format";
import type { ApiResponse, Captured, EndpointView, ReplayResult, ReplySettings } from "./types";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const btnSmall = `inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-40 ${focusRing}`;
const label = "block text-sm font-medium text-slate-700";
const METHOD_CLS: Record<string, string> = { GET: "bg-emerald-50 text-emerald-900", POST: "bg-blue-50 text-blue-900", PUT: "bg-amber-50 text-amber-950", PATCH: "bg-amber-50 text-amber-950", DELETE: "bg-red-50 text-red-900" };

async function call<T>(body: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(ACTIONS_PATH, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return ((await res.json().catch(() => null)) as ApiResponse<T> | null) ?? { ok: false, error: { code: "bad_response", message: "The server did not answer properly. Please try again." } };
}

/** Local time once the page runs in the browser; UTC before (so the server and the browser render the same text). */
function time(iso: string, local: boolean) {
  return local ? new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : `${iso.slice(11, 19)} UTC`;
}

function Table({ rows, empty }: { rows: [string, string][]; empty: string }) {
  if (!rows.length) return <p className="text-xs text-slate-600">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200" tabIndex={0} role="region" aria-label="Values">
      <table className="min-w-full text-xs">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={i} className="border-t border-slate-100 align-top first:border-t-0">
              <th scope="row" className="whitespace-nowrap px-2 py-1 text-left font-mono font-semibold text-slate-700">
                {k}
              </th>
              <td className="break-all px-2 py-1 font-mono">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Detail({ c, isSample, endpointId, onNotice, local }: { c: Captured; isSample: boolean; endpointId: string; onNotice: (s: string) => void; local: boolean }) {
  const uid = useId();
  const p = pretty(c);
  const [view, setView] = useState<"pretty" | "raw" | "hex">(p ? "pretty" : c.body.text === null ? "hex" : "raw");
  const [target, setTarget] = useState("");
  const [replayed, setReplayed] = useState<ReplayResult | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bodyText = view === "pretty" && p ? p.text : view === "hex" ? hexDump(base64ToBytes(c.body.base64)) : (c.body.text ?? `(binary, base64)\n${c.body.base64}`);

  const copyCurl = async () => {
    try {
      await navigator.clipboard.writeText(toCurl(c));
      onNotice("cURL command copied.");
    } catch {
      onNotice("Your browser blocked clipboard access.");
    }
  };

  const doReplay = async () => {
    if (isSample) return setReplayError("Create your own URL first: the example requests cannot be replayed.");
    setBusy(true);
    setReplayError(null);
    setReplayed(null);
    try {
      const r = await call<ReplayResult>({ action: "replay", id: endpointId, requestId: c.id, url: target });
      if (r.ok) setReplayed(r.data);
      else setReplayError(r.error.message);
    } catch {
      setReplayError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${METHOD_CLS[c.method] ?? "bg-slate-100 text-slate-800"}`}>{c.method}</span>
          <span className="break-all font-mono text-xs">{c.url}</span>
        </p>
        <p className="mt-1 text-xs text-slate-600">
          {local ? new Date(c.at).toLocaleString() : `${c.at.slice(0, 19).replace("T", " ")} UTC`} · {formatBytes(c.body.size)}
          {c.contentType ? ` · ${c.contentType}` : ""} · from {c.ip ?? "unknown address"}
        </p>
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Query</h4>
        <Table rows={c.query} empty="No query parameters." />
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Headers {c.headersTruncated && <span className="normal-case text-amber-900">(cut at 64 KB)</span>}</h4>
        <Table rows={c.headers} empty="No headers." />
      </div>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Body {c.body.truncated && <span className="normal-case text-amber-900">(cut at {MAX_BODY_BYTES / 1024} KB of {formatBytes(c.body.size)})</span>}
          </h4>
          {c.body.size > 0 && (
            <div className="flex gap-1" role="group" aria-label="Body view">
              {p && (
                <button type="button" className={`${btnSmall} ${view === "pretty" ? "border-primary bg-primary-soft" : ""}`} aria-pressed={view === "pretty"} onClick={() => setView("pretty")}>
                  {p.kind === "json" ? "JSON" : "Form"}
                </button>
              )}
              <button type="button" className={`${btnSmall} ${view === "raw" ? "border-primary bg-primary-soft" : ""}`} aria-pressed={view === "raw"} onClick={() => setView("raw")}>
                Raw
              </button>
              <button type="button" className={`${btnSmall} ${view === "hex" ? "border-primary bg-primary-soft" : ""}`} aria-pressed={view === "hex"} onClick={() => setView("hex")}>
                Hex
              </button>
            </div>
          )}
        </div>
        {c.body.size > 0 ? (
          <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono text-xs leading-5" tabIndex={0}>
            {bodyText}
          </pre>
        ) : (
          <p className="text-xs text-slate-600">No body.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnSecondary} onClick={() => void copyCurl()}>
          Copy as cURL
        </button>
      </div>
      <div className="rounded-xl border border-slate-200 p-3">
        <label htmlFor={`${uid}-rp`} className={label}>
          Replay to a URL <span className="font-normal text-slate-600">(GET and HEAD requests; others: copy as cURL)</span>
        </label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input id={`${uid}-rp`} type="url" inputMode="url" className={inputCls} placeholder="https://your-app.example.com/webhook" value={target} onChange={(e) => setTarget(e.target.value)} />
          <button type="button" className={btnSecondary} disabled={busy || !target.trim()} onClick={() => void doReplay()}>
            {busy ? "Sending…" : "Replay"}
          </button>
        </div>
        {replayError && (
          <p role="alert" className="mt-2 text-sm text-red-800">
            {replayError}
          </p>
        )}
        {replayed && (
          <div className="mt-2 text-xs">
            <p className="font-semibold">
              Answered {replayed.status} in {replayed.totalMs} ms
            </p>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-2 font-mono">{replayed.body || "(empty body)"}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WebhookTestUrlGeneratorTool() {
  const uid = useId();
  const [ep, setEp] = useState<EndpointView | null>(SAMPLE_ENDPOINT);
  const [hookUrl, setHookUrl] = useState(SAMPLE_URL);
  const [isSample, setIsSample] = useState(true);
  const [selected, setSelected] = useState<string | null>(SAMPLE_ENDPOINT.requests[0].id);
  const [live, setLive] = useState<"off" | "connecting" | "live" | "polling">("off");
  const [now, setNow] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReplySettings>(SAMPLE_ENDPOINT.reply);
  const es = useRef<EventSource | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const disconnect = () => {
    es.current?.close();
    es.current = null;
    if (poll.current) clearInterval(poll.current);
    poll.current = null;
    if (retry.current) clearTimeout(retry.current);
    retry.current = null;
  };
  useEffect(() => () => disconnect(), []);

  const gone = () => {
    disconnect();
    setLive("off");
    setFailure("This test URL has expired or was deleted. Create a new one.");
  };

  const startPolling = (id: string) => {
    if (poll.current) return;
    setLive("polling");
    poll.current = setInterval(async () => {
      const r = await call<EndpointView>({ action: "list", id }).catch(() => null);
      if (!r) return;
      if (r.ok) setEp(r.data);
      else if (r.error.code === "not_found") gone();
    }, POLL_MS);
  };

  const connect = (id: string) => {
    disconnect();
    setLive("connecting");
    const source = new EventSource(`${EVENTS_PATH}${id}`);
    es.current = source;
    source.onopen = () => {
      if (poll.current) clearInterval(poll.current);
      poll.current = null;
      setLive("live");
    };
    source.addEventListener("capture", (e) => {
      const { request } = JSON.parse((e as MessageEvent<string>).data) as { request: Captured };
      setEp((cur) => (cur ? { ...cur, requests: [request, ...cur.requests.filter((r) => r.id !== request.id)].slice(0, MAX_REQUESTS) } : cur));
    });
    source.addEventListener("cleared", () => setEp((cur) => (cur ? { ...cur, requests: [] } : cur)));
    source.addEventListener("updated", (e) => {
      const { endpoint } = JSON.parse((e as MessageEvent<string>).data) as { endpoint: EndpointView };
      setEp((cur) => (cur ? { ...cur, expiresAt: endpoint.expiresAt, extensionsLeft: endpoint.extensionsLeft, reply: endpoint.reply } : cur));
    });
    source.addEventListener("deleted", () => gone());
    source.onerror = () => {
      // The browser retries by itself; if the connection is closed, poll every 3 s and try the live view again later.
      if (source.readyState === EventSource.CLOSED) {
        es.current = null;
        startPolling(id);
        retry.current = setTimeout(() => connect(id), 30_000);
      } else startPolling(id);
    };
  };

  const create = async () => {
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      const r = await call<EndpointView>({ action: "create" });
      if (!r.ok) return setFailure(r.error.message);
      setEp(r.data);
      setDraft(r.data.reply);
      setHookUrl(`${window.location.origin}${HOOK_PATH}${r.data.id}`);
      setIsSample(false);
      setSelected(null);
      connect(r.data.id);
    } catch {
      setFailure("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: "extend" | "clear" | "delete") => {
    if (!ep || isSample) return;
    setFailure(null);
    const r = await call<EndpointView & { deleted?: boolean }>({ action, id: ep.id }).catch(() => null);
    if (!r) return setFailure("Could not reach the server.");
    if (!r.ok) return r.error.code === "not_found" ? gone() : setFailure(r.error.message);
    if (action === "delete") {
      disconnect();
      setLive("off");
      setEp(null);
      setNotice("The test URL and its requests were deleted.");
    } else {
      setEp(r.data);
      if (action === "clear") setSelected(null);
      setNotice(action === "extend" ? `Extended by ${TTL_MINUTES} minutes.` : "Requests cleared.");
    }
  };

  const saveReply = async () => {
    if (!ep || isSample) return setNotice("Create your own URL first; the response settings apply to it.");
    const r = await call<EndpointView>({ action: "reply", id: ep.id, reply: draft }).catch(() => null);
    if (!r) return setFailure("Could not reach the server.");
    if (!r.ok) return setFailure(r.error.message);
    setEp(r.data);
    setNotice(`Your URL now answers ${r.data.reply.status} after ${r.data.reply.delayMs} ms.`);
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(hookUrl);
      setNotice("URL copied.");
    } catch {
      setNotice("Your browser blocked clipboard access: select the URL and copy it.");
    }
  };

  const download = () => {
    if (!ep) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(ep.requests, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `requests-${ep.id.slice(0, 8)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const left = ep && now !== null ? Math.max(0, Math.round((Date.parse(ep.expiresAt) - now) / 60000)) : null;
  const current = ep?.requests.find((r) => r.id === selected) ?? ep?.requests[0] ?? null;

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Your test URL
        </h2>
        <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{PUBLIC_NOTE}</p>
        <div className="mt-3 space-y-3">
          {ep ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label htmlFor={`${uid}-u`} className="sr-only">
                  Test URL
                </label>
                <input id={`${uid}-u`} readOnly className={`${inputCls} font-mono text-xs`} value={hookUrl} onFocus={(e) => e.target.select()} />
                <button type="button" className={btnSecondary} onClick={() => void copyUrl()}>
                  Copy URL
                </button>
              </div>
              <p className="text-xs text-slate-600">
                {isSample ? "Example URL: nothing is created until you press Create URL." : `Temporary: expires in ${left ?? "…"} min (extensions left: ${ep.extensionsLeft}). Data is kept in memory and lost on a server restart.`}{" "}
                {!isSample && <span>Live view: {live === "live" ? "connected" : live === "polling" ? "checking every 3 s" : live === "connecting" ? "connecting…" : "off"}.</span>}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-700">No test URL yet. Press Create URL to get one that lives {TTL_MINUTES} minutes.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} onClick={() => void create()} disabled={busy}>
              {busy ? "Creating…" : isSample || !ep ? "Create URL" : "Create another URL"}
            </button>
            {!isSample && ep && (
              <>
                <button type="button" className={btnSecondary} onClick={() => void act("extend")} disabled={ep.extensionsLeft === 0}>
                  Extend {TTL_MINUTES} min
                </button>
                <button type="button" className={btnSecondary} onClick={() => void act("clear")}>
                  Clear requests
                </button>
                <button type="button" className={btnSecondary} onClick={() => void act("delete")}>
                  Delete URL
                </button>
              </>
            )}
            {!isSample && (
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  disconnect();
                  setLive("off");
                  setEp(SAMPLE_ENDPOINT);
                  setHookUrl(SAMPLE_URL);
                  setIsSample(true);
                  setSelected(SAMPLE_ENDPOINT.requests[0].id);
                  setFailure(null);
                  setNotice(null);
                }}
              >
                Try an example
              </button>
            )}
          </div>
          <p className="text-xs text-slate-600">
            Free and temporary: each URL lives {TTL_MINUTES} minutes (extend up to 3 times), keeps the last {MAX_REQUESTS} requests, accepts 60 requests a minute, and bodies are cut at {MAX_BODY_BYTES / 1024} KB. Up to {MAX_ACTIVE_PER_IP} URLs at a time.
          </p>
        </div>
      </section>

      {failure && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {failure}
        </div>
      )}

      <section className={`${card} min-h-64`} aria-labelledby={`${uid}-out`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${uid}-out`} className="text-lg font-semibold">
            Requests {ep ? `(${ep.requests.length})` : ""}
          </h2>
          {isSample && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Example requests</span>}
          {ep && ep.requests.length > 0 && (
            <button type="button" className={btnSmall} onClick={download}>
              Download JSON
            </button>
          )}
        </div>
        <div aria-live="polite" className="mt-2 text-sm text-slate-700">
          {notice && <p>{notice}</p>}
        </div>
        {ep && ep.requests.length === 0 && (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-700">
            <p>Waiting for requests. Send one, for example:</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-2 font-mono text-xs">{`curl -X POST -H 'content-type: application/json' -d '{"hello":"world"}' '${hookUrl}'`}</pre>
          </div>
        )}
        {ep && ep.requests.length > 0 && (
          <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
            <ul className="max-h-[32rem] space-y-1 overflow-auto" aria-label="Captured requests">
              {ep.requests.map((r) => (
                <li key={r.id}>
                  <button type="button" aria-current={current?.id === r.id} onClick={() => setSelected(r.id)} className={`w-full rounded-xl border px-2 py-1.5 text-left text-xs ${focusRing} ${current?.id === r.id ? "border-primary bg-primary-soft" : "border-slate-200 hover:bg-slate-50"}`}>
                    <span className={`mr-1 rounded px-1 py-0.5 font-bold ${METHOD_CLS[r.method] ?? "bg-slate-100"}`}>{r.method}</span>
                    <span className="font-mono">{time(r.at, now !== null)}</span>
                    <span className="block truncate text-slate-600">
                      {r.path.split("/").slice(6).join("/") || "/"}
                      {r.query.length ? `?${r.query.map(([k]) => k).join("&")}` : ""} · {formatBytes(r.body.size)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {current && <Detail key={current.id} c={current} isSample={isSample} endpointId={ep.id} onNotice={setNotice} local={now !== null} />}
          </div>
        )}
        {ep && (
          <details className="mt-6 rounded-xl border border-slate-200 p-3">
            <summary className={`cursor-pointer text-sm font-semibold ${focusRing} rounded`}>Custom response (now: {ep.reply.status}, {ep.reply.contentType})</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor={`${uid}-st`} className={label}>
                  Status code
                </label>
                <input id={`${uid}-st`} type="number" min={200} max={599} className={`${inputCls} mt-1`} value={draft.status} onChange={(e) => setDraft({ ...draft, status: Number(e.target.value) })} />
              </div>
              <div>
                <label htmlFor={`${uid}-ct`} className={label}>
                  Content type
                </label>
                <select id={`${uid}-ct`} className={`${inputCls} mt-1`} value={draft.contentType} onChange={(e) => setDraft({ ...draft, contentType: e.target.value as ReplyType })}>
                  {REPLY_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${uid}-dl`} className={label}>
                  Delay (ms, up to {MAX_DELAY_MS})
                </label>
                <input id={`${uid}-dl`} type="number" min={0} max={MAX_DELAY_MS} step={100} className={`${inputCls} mt-1`} value={draft.delayMs} onChange={(e) => setDraft({ ...draft, delayMs: Number(e.target.value) })} />
              </div>
              <div className="sm:col-span-3">
                <label htmlFor={`${uid}-bd`} className={label}>
                  Response body (up to 10 KB)
                </label>
                <textarea id={`${uid}-bd`} className={`${inputCls} mt-1 min-h-20 font-mono text-xs`} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
              </div>
            </div>
            <button type="button" className={`${btnSecondary} mt-3`} onClick={() => void saveReply()}>
              Save response
            </button>
          </details>
        )}
      </section>
    </div>
  );
}
