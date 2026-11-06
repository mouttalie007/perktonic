"use client";

import { useEffect, useId, useRef, useState } from "react";
import { normalizeHost } from "./logic/host";
import { reportText } from "./logic/report";
import { PORTS, RATE_LIMIT, type Level, type SslResult } from "./logic/types";
import { EXAMPLE_HOST } from "../fixtures/examples";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/ssl-certificate-checker";

const LEVEL: Record<Level, { label: string; cls: string }> = {
  error: { label: "Problem", cls: "border-red-200 bg-red-50 text-red-900" },
  warning: { label: "Warning", cls: "border-amber-300 bg-amber-50 text-amber-950" },
  info: { label: "Note", cls: "border-slate-200 bg-slate-50 text-slate-800" },
  good: { label: "OK", cls: "border-green-200 bg-green-50 text-green-900" },
};
const PORT_LABEL: Record<number, string> = { 443: "443 (HTTPS)", 465: "465 (SMTPS)", 993: "993 (IMAPS)", 995: "995 (POP3S)", 8443: "8443 (HTTPS alt)" };
const VERSION_LABEL: Record<string, string> = { TLSv1: "TLS 1.0", "TLSv1.1": "TLS 1.1", "TLSv1.2": "TLS 1.2", "TLSv1.3": "TLS 1.3" };
const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

export default function SslCertificateCheckerTool() {
  const uid = useId();
  // Kind B: only the host field is pre-filled; nothing is checked until the visitor asks.
  const [host, setHost] = useState(EXAMPLE_HOST);
  const [port, setPort] = useState<number>(443);
  const [result, setResult] = useState<SslResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const check = async (target: string, p: number) => {
    const typedPort = /:(\d+)(\/|$)/.exec(target.replace(/^https?:\/\//, ""))?.[1];
    const h = normalizeHost(target, typedPort ? null : p);
    if (!h.ok) {
      setResult(null);
      setError(h.error);
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ host: h.host, port: h.port }), signal: ctrl.signal });
      const body = (await res.json().catch(() => null)) as { ok: true; data: SslResult } | { ok: false; error: { message: string } } | null;
      if (!body) throw new Error(res.status === 429 ? `You have run ${RATE_LIMIT.limit} checks in the last 10 minutes. Try again in a few minutes.` : "The checker did not answer properly. Please try again.");
      if (body.ok) {
        setResult(body.data);
        setTimeout(() => heading.current?.focus(), 0);
      } else {
        setResult(null);
        setError(body.error.message);
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setResult(null);
      setError(e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not reach the checker. Check your connection and try again.");
    } finally {
      if (abort.current === ctrl) setBusy(false);
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Use the download instead.");
    }
  };

  const save = (text: string, name: string, type: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const days = result?.daysLeft ?? null;

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Server to check
        </h2>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_11rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void check(host, port);
          }}
        >
          <div className="min-w-0">
            <label htmlFor={`${uid}-h`} className="block text-sm text-slate-600">
              Domain name (or URL)
            </label>
            <input id={`${uid}-h`} className={`${inputCls} mt-1 font-mono`} value={host} onChange={(e) => setHost(e.target.value)} spellCheck={false} autoCapitalize="off" maxLength={2048} placeholder="example.com" />
          </div>
          <div>
            <label htmlFor={`${uid}-p`} className="block text-sm text-slate-600">
              Port
            </label>
            <select id={`${uid}-p`} className={`${inputCls} mt-1`} value={port} onChange={(e) => setPort(Number(e.target.value))}>
              {PORTS.map((p) => (
                <option key={p} value={p}>
                  {PORT_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              Check
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={busy}
              onClick={() => {
                setHost(EXAMPLE_HOST);
                setPort(443);
                void check(EXAMPLE_HOST, 443);
              }}
            >
              Try an example
            </button>
          </div>
        </form>
        <p className="mt-3 text-xs text-slate-600">Each check opens up to 5 connections from our server: one to read the certificate, and one per TLS version (1.0 to 1.3). Limit: {RATE_LIMIT.limit} checks per 10 minutes.</p>
      </section>

      <div aria-live="polite" className="min-h-6 text-sm text-slate-700">
        {busy && <span className="motion-safe:animate-pulse">Connecting and testing TLS 1.0, 1.1, 1.2 and 1.3…</span>}
        {!busy && notice}
        {!busy && !result && !error && !notice && "Press “Check” to inspect the server above. Nothing is sent until you do."}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {result && (
        <>
          <section className={card} aria-labelledby={`${uid}-res`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 id={`${uid}-res`} ref={heading} tabIndex={-1} className="break-all text-lg font-semibold outline-none">
                {result.host}
                <span className="font-normal text-slate-600">:{result.port}</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnSecondary} onClick={() => copy(reportText(result), "Report")}>
                  Copy report
                </button>
                <button type="button" className={btnSecondary} onClick={() => save(JSON.stringify(result, null, 2), `ssl-${result.host}.json`, "application/json")}>
                  Download JSON
                </button>
              </div>
            </div>
            <div className={`mt-4 flex flex-wrap items-center gap-4 rounded-xl border p-4 ${LEVEL[result.verdict.level].cls}`}>
              {days !== null && (
                <p className="text-center">
                  <span className="block text-4xl font-bold tabular-nums">{Math.abs(days)}</span>
                  <span className="text-xs font-semibold uppercase tracking-wide">{days < 0 ? "days since expiry" : days === 1 ? "day left" : "days left"}</span>
                </p>
              )}
              <p className="min-w-0 flex-1 text-sm font-semibold">{result.verdict.text}</p>
            </div>
            <ul className="mt-3 space-y-2">
              {result.checks.map((c) => (
                <li key={c.id} className={`rounded-xl border p-3 text-sm ${LEVEL[c.level].cls}`}>
                  <span className="mr-2 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold">{LEVEL[c.level].label}</span>
                  <span className="font-semibold">{c.title}.</span> {c.detail}
                </li>
              ))}
            </ul>
          </section>

          <section className={card} aria-labelledby={`${uid}-proto`}>
            <h2 id={`${uid}-proto`} className="text-lg font-semibold">
              Protocols and connection
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {result.versions.map((v) => (
                <li key={v.version} className={`rounded-xl border p-3 text-center text-sm ${v.accepted === null ? "border-slate-200 bg-slate-50" : v.accepted ? (v.version === "TLSv1" || v.version === "TLSv1.1" ? "border-amber-300 bg-amber-50" : "border-green-200 bg-green-50") : "border-slate-200"}`}>
                  <span className="block font-semibold">{VERSION_LABEL[v.version]}</span>
                  <span className="text-xs">{v.accepted === null ? `Not tested (${v.note})` : v.accepted ? "Accepted" : "Refused"}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {[
                ["Negotiated", result.protocol ? VERSION_LABEL[result.protocol] ?? result.protocol : "—"],
                ["Cipher", result.cipher ?? "—"],
                ["ALPN (HTTP version)", result.alpn ?? "none"],
                ["Server IP", result.ip ?? "—"],
                ["Handshake", result.handshakeMs !== null ? `${result.handshakeMs} ms` : "—"],
                ["Checked", new Date(result.checkedAt).toUTCString()],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">{k}</dt>
                  <dd className="break-all font-mono text-xs">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-slate-600">Only the cipher negotiated with our server is shown; a full list of supported ciphers is not part of this check.</p>
          </section>

          <section className={card} aria-labelledby={`${uid}-chain`}>
            <h2 id={`${uid}-chain`} className="text-lg font-semibold">
              Certificate chain
            </h2>
            <ol className="mt-3 space-y-3">
              {result.chain.map((c, i) => (
                <li key={c.fingerprint256} className="rounded-xl border border-slate-200 p-3 text-sm" style={{ marginLeft: `${Math.min(i, 3) * 0.75}rem` }}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {c.role === "leaf" ? "Server certificate" : c.role === "root" ? "Root" : "Intermediate"}
                    {c.selfSigned && c.role === "leaf" ? " · self-signed" : ""}
                  </p>
                  <p className="mt-1 break-all font-semibold">{c.commonName ?? c.subject}</p>
                  <p className="break-words text-slate-700">Issued by {c.issuerName ?? c.issuer}</p>
                  <p className="text-slate-700">
                    {date(c.validFrom)} → {date(c.validTo)} ({c.daysLeft < 0 ? `expired ${-c.daysLeft} days ago` : `${c.daysLeft} days left`}) · {c.keyType ? `${c.keyType.toUpperCase()} ${c.keyBits ?? ""}`.trim() : "key type unknown"}
                  </p>
                  {c.role === "leaf" && c.san.length > 0 && (
                    <p className="mt-1 break-all text-xs text-slate-700">
                      <span className="font-semibold">Names: </span>
                      {c.san.map((s) => s.replace(/^(DNS|IP Address|IP):/, "")).join(", ")}
                    </p>
                  )}
                  {c.role === "root" && <p className="mt-1 text-xs text-slate-600">Roots usually come from our server&apos;s own trust store, so this one may not have been sent by the server.</p>}
                  <details className="mt-1 text-xs">
                    <summary className={`cursor-pointer rounded text-slate-600 ${focusRing}`}>Serial and fingerprint</summary>
                    <p className="mt-1 break-all font-mono">Serial {c.serial}</p>
                    <p className="break-all font-mono">SHA-256 {c.fingerprint256}</p>
                  </details>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
