"use client";

import { useEffect, useId, useRef, useState } from "react";
import { normalizeDomain } from "./logic/domain";
import { reportText, worst } from "./logic/report";
import { COMMON_SELECTORS, RATE_LIMIT, type Check, type EmailAuthResult, type Level, type SpfNode } from "./logic/types";
import { EXAMPLE_DOMAIN } from "../fixtures/examples";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/spf-dkim-dmarc-checker";

const LEVEL: Record<Level, { label: string; cls: string; chip: string }> = {
  error: { label: "Problem", cls: "border-red-200 bg-red-50 text-red-900", chip: "bg-red-100 text-red-900" },
  warning: { label: "Warning", cls: "border-amber-300 bg-amber-50 text-amber-950", chip: "bg-amber-100 text-amber-950" },
  info: { label: "Note", cls: "border-slate-200 bg-slate-50 text-slate-800", chip: "bg-slate-100 text-slate-800" },
  good: { label: "OK", cls: "border-green-200 bg-green-50 text-green-900", chip: "bg-green-100 text-green-900" },
};

function Checks({ list }: { list: Check[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {list.map((c, i) => (
        <li key={i} className={`rounded-xl border p-3 text-sm ${LEVEL[c.level].cls}`}>
          <span className="mr-2 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold">{LEVEL[c.level].label}</span>
          {c.message}
        </li>
      ))}
    </ul>
  );
}

function Tree({ node }: { node: SpfNode }) {
  return (
    <li>
      <span className="font-mono text-xs">
        {node.via !== "start" && <span className="text-slate-500">{node.via}: </span>}
        {node.domain}
      </span>
      {node.lookups > 0 && <span className="ml-2 text-xs text-slate-600">{node.lookups} lookup{node.lookups === 1 ? "" : "s"}</span>}
      {node.problem && <span className="ml-2 text-xs font-semibold text-red-800">{node.problem}</span>}
      {node.children.length > 0 && (
        <ul className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-3">
          {node.children.map((c, i) => (
            <Tree key={i} node={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Suggestion({ label, value, onCopy }: { label: string; value: string | null; onCopy: (text: string, what: string) => void }) {
  if (!value) return null;
  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-primary-soft p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <button type="button" className={`${btnSecondary} px-2 py-1 text-xs`} onClick={() => onCopy(value, label)}>
          Copy
        </button>
      </div>
      <code className="mt-2 block break-all font-mono text-xs">{value}</code>
    </div>
  );
}

function Record({ value, where }: { value: string | null; where: string }) {
  return (
    <p className="mt-2 break-all rounded-xl bg-slate-50 p-3 font-mono text-xs">
      <span className="block font-sans text-xs text-slate-600">{where}</span>
      {value ?? "No record found"}
    </p>
  );
}

export default function SpfDkimDmarcCheckerTool() {
  const uid = useId();
  // Kind B: only the domain field is pre-filled; nothing is checked until the visitor asks.
  const [domain, setDomain] = useState(EXAMPLE_DOMAIN);
  const [selector, setSelector] = useState("");
  const [result, setResult] = useState<EmailAuthResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const check = async (target: string, sel: string) => {
    const norm = normalizeDomain(target);
    if (!norm.ok) {
      setResult(null);
      setError(norm.error);
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ domain: target, selector: sel || undefined }), signal: ctrl.signal });
      const body = (await res.json().catch(() => null)) as { ok: true; data: EmailAuthResult } | { ok: false; error: { message: string } } | null;
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
      setNotice("Your browser blocked clipboard access. Select the text instead.");
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

  const sections = result
    ? ([
        ["SPF", worst(result.spf.checks)],
        ["DMARC", worst(result.dmarc.checks)],
        ["DKIM", worst(result.dkim.checks)],
        ["MTA-STS", worst(result.mtaSts.checks)],
        ["BIMI", worst(result.bimi.checks)],
      ] as const)
    : [];

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          Domain to check
        </h2>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void check(domain, selector);
          }}
        >
          <div className="min-w-0">
            <label htmlFor={`${uid}-d`} className="block text-sm text-slate-600">
              Domain (or an email address)
            </label>
            <input id={`${uid}-d`} className={`${inputCls} mt-1 font-mono`} value={domain} onChange={(e) => setDomain(e.target.value)} spellCheck={false} autoCapitalize="off" maxLength={2048} placeholder="example.com" />
          </div>
          <div>
            <label htmlFor={`${uid}-s`} className="block text-sm text-slate-600">
              DKIM selector (optional)
            </label>
            <input id={`${uid}-s`} className={`${inputCls} mt-1 font-mono`} value={selector} onChange={(e) => setSelector(e.target.value)} spellCheck={false} autoCapitalize="off" maxLength={63} placeholder="e.g. google" />
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
                setDomain(EXAMPLE_DOMAIN);
                setSelector("");
                void check(EXAMPLE_DOMAIN, "");
              }}
            >
              Try an example
            </button>
          </div>
        </form>
        <p className="mt-3 text-xs text-slate-600">
          Without a selector, {COMMON_SELECTORS.length} common DKIM selectors are tried. The domain is looked up through a public DNS resolver (Cloudflare); MTA-STS policies are fetched from the domain&apos;s own site. Limit: {RATE_LIMIT.limit} checks per 10 minutes.
        </p>
      </section>

      <div aria-live="polite" className="min-h-6 text-sm text-slate-700">
        {busy && <span className="motion-safe:animate-pulse">Checking SPF, DMARC, DKIM, MTA-STS and BIMI…</span>}
        {!busy && notice}
        {!busy && !result && !error && !notice && "Press “Check” to look up the domain above. Nothing is sent until you do."}
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
                {result.domain}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnSecondary} onClick={() => copy(reportText(result), "Report")}>
                  Copy report
                </button>
                <button type="button" className={btnSecondary} onClick={() => save(reportText(result), `email-auth-${result.domain}.txt`, "text/plain;charset=utf-8")}>
                  Download report
                </button>
              </div>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {sections.map(([name, level]) => (
                <li key={name}>
                  <a href={`#${uid}-${name}`} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${LEVEL[level].chip} ${focusRing}`}>
                    {name}
                    <span className="text-xs font-normal">{LEVEL[level].label}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-600">
              {result.queries} DNS queries{result.budgetReached ? " (the 40-query limit was reached; some nested records were not followed)" : ""}. This checks the published records only; it cannot tell whether a given message will be delivered.
            </p>
          </section>

          <section id={`${uid}-SPF`} className={card} aria-labelledby={`${uid}-spf`}>
            <h2 id={`${uid}-spf`} className="text-lg font-semibold">
              SPF <span className="text-sm font-normal text-slate-600">· {result.spf.lookups} of 10 DNS lookups</span>
            </h2>
            {result.spf.records.length > 1 ? result.spf.records.map((r, i) => <Record key={i} value={r} where={`TXT record ${i + 1} at ${result.domain}`} />) : <Record value={result.spf.record} where={`TXT at ${result.domain}`} />}
            <Checks list={result.spf.checks} />
            {result.spf.tree && result.spf.tree.children.length > 0 && (
              <details className="mt-3">
                <summary className={`cursor-pointer rounded text-sm font-semibold ${focusRing}`}>Include tree</summary>
                <ul className="mt-2">
                  <Tree node={result.spf.tree} />
                </ul>
              </details>
            )}
            <Suggestion label="Suggested SPF record" value={result.spf.suggestion} onCopy={copy} />
          </section>

          <section id={`${uid}-DMARC`} className={card} aria-labelledby={`${uid}-dmarc`}>
            <h2 id={`${uid}-dmarc`} className="text-lg font-semibold">
              DMARC
            </h2>
            <Record value={result.dmarc.record} where={`TXT at ${result.dmarc.foundAt ?? `_dmarc.${result.domain}`}`} />
            <Checks list={result.dmarc.checks} />
            <Suggestion label="Suggested DMARC record" value={result.dmarc.suggestion !== result.dmarc.record ? result.dmarc.suggestion : null} onCopy={copy} />
          </section>

          <section id={`${uid}-DKIM`} className={card} aria-labelledby={`${uid}-dkim`}>
            <h2 id={`${uid}-dkim`} className="text-lg font-semibold">
              DKIM <span className="text-sm font-normal text-slate-600">· {result.dkim.mode === "probe" ? `${result.dkim.selectorsTried.length} common selectors tried` : `selector “${result.dkim.selectorsTried[0]}”`}</span>
            </h2>
            {result.dkim.found.map((k) => (
              <Record key={k.selector} value={k.record} where={`${k.selector}._domainkey.${result.domain}`} />
            ))}
            <Checks list={result.dkim.checks} />
          </section>

          <section id={`${uid}-MTA-STS`} className={card} aria-labelledby={`${uid}-mta`}>
            <h2 id={`${uid}-mta`} className="text-lg font-semibold">
              MTA-STS
            </h2>
            <Record value={result.mtaSts.record} where={`TXT at _mta-sts.${result.domain}`} />
            {result.mtaSts.policy && (
              <p className="mt-2 text-sm">
                Policy at <span className="break-all font-mono text-xs">{result.mtaSts.policyUrl}</span>: mode {result.mtaSts.policy.mode ?? "?"}, mx {result.mtaSts.policy.mx.join(", ") || "none"}, max_age {result.mtaSts.policy.maxAge ?? "?"} s.
              </p>
            )}
            <Checks list={result.mtaSts.checks} />
          </section>

          <section id={`${uid}-BIMI`} className={card} aria-labelledby={`${uid}-bimi`}>
            <h2 id={`${uid}-bimi`} className="text-lg font-semibold">
              BIMI
            </h2>
            <Record value={result.bimi.record} where={`TXT at default._bimi.${result.domain}`} />
            <Checks list={result.bimi.checks} />
          </section>
        </>
      )}
    </div>
  );
}
