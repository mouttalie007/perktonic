"use client";

import { useEffect, useId, useRef, useState } from "react";
import { normalizeDomain } from "./logic/domain";
import { recordsCsv, reportText } from "./logic/report";
import { RATE_LIMIT, RECORD_TYPES, RESOLVER, type Finding, type LookupResult, type RecordType } from "./logic/types";
import { EXAMPLE_DOMAIN } from "../fixtures/examples";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/dns-lookup-tool";

const LEVEL: Record<Finding["level"], { label: string; cls: string }> = {
  error: { label: "Problem", cls: "border-red-200 bg-red-50 text-red-900" },
  warning: { label: "Warning", cls: "border-amber-300 bg-amber-50 text-amber-950" },
  info: { label: "Note", cls: "border-slate-200 bg-slate-50 text-slate-800" },
  good: { label: "OK", cls: "border-green-200 bg-green-50 text-green-900" },
};

const STATUS: Record<string, string> = { nodata: "No record of this type", nxdomain: "Name does not exist", servfail: "The name servers failed to answer", error: "Could not be looked up", skipped: "Not checked" };

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "—");
const ttl = (s: number) => (s >= 86400 && s % 3600 === 0 ? `${s / 3600} h` : s >= 3600 && s % 60 === 0 ? `${s / 60} min` : `${s} s`);

function save(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DnsLookupToolTool() {
  const uid = useId();
  // Kind B: only the field is pre-filled; nothing is looked up until the visitor asks.
  const [domain, setDomain] = useState(EXAMPLE_DOMAIN);
  const [types, setTypes] = useState<RecordType[]>([...RECORD_TYPES]);
  const [whois, setWhois] = useState(true);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const lookup = async (target: string) => {
    const check = normalizeDomain(target);
    if (!check.ok) {
      setResult(null);
      setError(check.error);
      return;
    }
    if (types.length === 0) {
      setError("Choose at least one record type.");
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ domain: target, types, whois }), signal: ctrl.signal });
      const body = (await res.json().catch(() => null)) as { ok: true; data: LookupResult } | { ok: false; error: { message: string } } | null;
      if (!body) throw new Error(res.status === 429 ? `You have run ${RATE_LIMIT.limit} lookups in the last 10 minutes. Try again in a few minutes.` : "The lookup service did not answer properly. Please try again.");
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
      setError(e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not reach the lookup service. Check your connection and try again.");
    } finally {
      if (abort.current === ctrl) setBusy(false);
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Use the downloads instead.");
    }
  };

  const toggle = (t: RecordType) => setTypes((list) => (list.includes(t) ? list.filter((x) => x !== t) : RECORD_TYPES.filter((x) => x === t || list.includes(x))));
  const reg = result?.registration;

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Domain to look up
        </h2>
        <form
          className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(domain);
          }}
        >
          <div className="min-w-0 flex-1">
            <label htmlFor={`${uid}-d`} className="block text-sm text-slate-600">
              Domain name (a URL or email address works too)
            </label>
            <input id={`${uid}-d`} className={`${inputCls} mt-1 font-mono`} value={domain} onChange={(e) => setDomain(e.target.value)} spellCheck={false} autoCapitalize="off" maxLength={2048} aria-invalid={error ? true : undefined} placeholder="example.com" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              Look up
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={busy}
              onClick={() => {
                setDomain(EXAMPLE_DOMAIN);
                void lookup(EXAMPLE_DOMAIN);
              }}
            >
              Try an example
            </button>
          </div>
        </form>
        <fieldset className="mt-4">
          <legend className="text-sm text-slate-600">Record types</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {RECORD_TYPES.map((t) => (
              <label key={t} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-sm ${types.includes(t) ? "border-primary bg-primary-soft" : "border-slate-300"}`}>
                <input type="checkbox" className={`accent-primary ${focusRing}`} checked={types.includes(t)} onChange={() => toggle(t)} />
                {t}
              </label>
            ))}
            <label className="inline-flex items-center gap-1.5 px-1 text-sm">
              <input type="checkbox" className={`accent-primary ${focusRing}`} checked={whois} onChange={(e) => setWhois(e.target.checked)} />
              Registration data (RDAP)
            </label>
          </div>
        </fieldset>
        <p className="mt-3 text-xs text-slate-600">
          The domain name is sent to {RESOLVER} for the DNS records and, for registration data, to the registry&apos;s RDAP server. Limit: {RATE_LIMIT.limit} lookups per 10 minutes. IP addresses are not accepted.
        </p>
      </section>

      <div aria-live="polite" className="min-h-6 text-sm text-slate-700">
        {busy && <span className="motion-safe:animate-pulse">Looking up {types.length} record type{types.length === 1 ? "" : "s"}…</span>}
        {!busy && notice}
        {!busy && !result && !error && !notice && "Press “Look up” to query the domain above. Nothing is sent until you do."}
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
                {result.unicode ?? result.domain}
                {result.unicode && <span className="ml-2 font-mono text-sm font-normal text-slate-600">{result.domain}</span>}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnSecondary} onClick={() => copy(reportText(result), "Report")}>
                  Copy report
                </button>
                <button type="button" className={btnSecondary} onClick={() => save(recordsCsv(result), `dns-${result.domain}.csv`, "text/csv;charset=utf-8")}>
                  Download CSV
                </button>
                <button type="button" className={btnSecondary} onClick={() => save(JSON.stringify(result, null, 2), `dns-${result.domain}.json`, "application/json")}>
                  JSON
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {result.queries} DNS queries via {result.resolver} · {new Date(result.checkedAt).toUTCString()}
              {result.results.some((r) => r.dnssec) && " · DNSSEC validated"}
            </p>
            <ul className="mt-3 space-y-2">
              {result.findings.map((f) => (
                <li key={f.code} className={`rounded-xl border p-3 text-sm ${LEVEL[f.level].cls}`}>
                  <span className="mr-2 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold">{LEVEL[f.level].label}</span>
                  {f.message}
                </li>
              ))}
            </ul>
          </section>

          <section className={card} aria-labelledby={`${uid}-rec`}>
            <h2 id={`${uid}-rec`} className="text-lg font-semibold">
              Records
            </h2>
            {result.chain.length > 0 && (
              <p className="mt-2 break-all rounded-xl bg-slate-50 p-3 font-mono text-xs">
                CNAME chain: {[result.domain, ...result.chain.map((c) => c.data)].join(" → ")}
              </p>
            )}
            <div className={`relative mt-3 overflow-x-auto ${focusRing}`} role="region" aria-label="DNS records" tabIndex={0}>
              <table className="w-full min-w-[36rem] text-left text-sm">
                <caption className="sr-only">DNS records by type, with their time to live</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-600">
                    <th scope="col" className="w-20 py-2 pr-3">
                      Type
                    </th>
                    <th scope="col" className="py-2 pr-3">
                      Value
                    </th>
                    <th scope="col" className="w-24 py-2 pr-3 text-right">
                      TTL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((t) =>
                    t.records.length === 0 ? (
                      <tr key={t.type} className="border-b border-slate-100">
                        <th scope="row" className="py-2 pr-3 text-left font-mono font-semibold">
                          {t.type}
                        </th>
                        <td className="py-2 pr-3 text-slate-600" colSpan={2}>
                          {STATUS[t.status] ?? t.status}
                        </td>
                      </tr>
                    ) : (
                      t.records.map((r, i) => (
                        <tr key={`${t.type}-${i}`} className="border-b border-slate-100 align-top">
                          <th scope="row" className="py-2 pr-3 text-left font-mono font-semibold">
                            {i === 0 ? t.type : <span className="sr-only">{t.type}</span>}
                          </th>
                          <td className="break-all py-2 pr-3 font-mono text-xs">
                            {r.name !== result.domain && <span className="block text-slate-500">{r.name}</span>}
                            {r.data}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono text-xs">{ttl(r.ttl)}</td>
                        </tr>
                      ))
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {reg && (
            <section className={card} aria-labelledby={`${uid}-reg`}>
              <h2 id={`${uid}-reg`} className="text-lg font-semibold">
                Registration (RDAP)
              </h2>
              {reg.status === "ok" ? (
                <>
                  <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      ["Registered domain", reg.domain ?? "—"],
                      ["Registrar", `${reg.registrar ?? "—"}${reg.registrarIanaId ? ` (IANA ID ${reg.registrarIanaId})` : ""}`],
                      ["Created", fmtDate(reg.created)],
                      ["Last updated", fmtDate(reg.updated)],
                      ["Expires", fmtDate(reg.expires)],
                      ["DNSSEC at the registry", reg.dnssecSigned === null ? "not stated" : reg.dnssecSigned ? "signed" : "not signed"],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">{k}</dt>
                        <dd className="break-words">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-sm">
                    <span className="font-semibold">Name servers:</span> <span className="break-all font-mono text-xs">{reg.nameservers.join(", ") || "—"}</span>
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-semibold">Status:</span> {reg.statuses.join(", ") || "—"}
                  </p>
                  <p className="mt-2 text-xs text-slate-600">From {reg.server}. Contact details of the registrant are not shown.</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-700">{reg.message}</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
