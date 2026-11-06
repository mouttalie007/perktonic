"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ResponseData } from "./api/schema";
import { postJson, saveFile } from "./client";
import type { Preview } from "./logic/previews";
import { fixSnippet, reportText } from "./logic/report";
import { EXAMPLE_URL } from "../fixtures/example";
import { btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const ENDPOINT = "/api/tools/opengraph-and-meta-tag-validator";

type Status = "empty" | "loading" | "done" | "error";


const SEVERITY = {
  error: { label: "Fix", cls: "border-red-200 bg-red-50 text-red-900" },
  warning: { label: "Improve", cls: "border-amber-200 bg-amber-50 text-amber-900" },
  info: { label: "Info", cls: "border-slate-200 bg-slate-50 text-navy" },
  good: { label: "Good", cls: "border-green-200 bg-green-50 text-green-900" },
} as const;

const AREA = { seo: "Search", opengraph: "OpenGraph", twitter: "X / Twitter", image: "Image" } as const;

function Thumb({ p, className }: { p: Preview; className: string }) {
  if (!p.image) return <div className={`${className} flex items-center justify-center bg-slate-200 text-xs text-slate-ink`}>No image</div>;
  if (!p.image.dataUrl) return <div className={`${className} flex items-center justify-center bg-slate-200 p-2 text-center text-xs text-slate-ink`}>Image too large to preview</div>;
  // A data: URL produced by our API (never a third-party URL), so next/image is not useful here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={p.image.dataUrl} alt="" className={`${className} object-cover`} />;
}

function Label({ name }: { name: string }) {
  return <p className="mb-2 text-xs font-semibold text-slate-ink">{name} <span className="font-normal">(approximate)</span></p>;
}

function FacebookCard({ p }: { p: Preview }) {
  const large = p.layout === "large";
  return (
    <div>
      <Label name="Facebook" />
      <div className={`overflow-hidden border border-[#dadde1] bg-white ${large ? "" : "flex"}`}>
        {p.layout !== "none" && <Thumb p={p} className={large ? "aspect-[1.91/1] w-full" : "h-28 w-28 shrink-0"} />}
        <div className="min-w-0 bg-[#f0f2f5] px-3 py-2">
          <p className="truncate text-xs uppercase text-[#65676b]">{p.domain}</p>
          <p className="line-clamp-2 text-[15px] font-semibold leading-5 text-[#050505]">{p.title}</p>
          {p.description && <p className="line-clamp-1 text-sm text-[#65676b]">{p.description}</p>}
        </div>
      </div>
    </div>
  );
}

function XCard({ p }: { p: Preview & { card: string } }) {
  if (p.layout === "large") {
    return (
      <div>
        <Label name={`X (${p.card})`} />
        <div className="relative overflow-hidden rounded-2xl border border-[#cfd9de]">
          <Thumb p={p} className="aspect-[1.91/1] w-full" />
          <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">{p.title}</span>
        </div>
        <p className="mt-1 text-xs text-[#536471]">From {p.domain}</p>
      </div>
    );
  }
  return (
    <div>
      <Label name={`X (${p.card})`} />
      <div className="flex overflow-hidden rounded-2xl border border-[#cfd9de]">
        <Thumb p={p} className="h-28 w-28 shrink-0 border-r border-[#cfd9de]" />
        <div className="min-w-0 p-3 text-sm">
          <p className="truncate text-[#536471]">{p.domain}</p>
          <p className="truncate text-[#0f1419]">{p.title}</p>
          {p.description && <p className="line-clamp-2 text-[#536471]">{p.description}</p>}
        </div>
      </div>
    </div>
  );
}

function LinkedInCard({ p }: { p: Preview }) {
  const large = p.layout === "large";
  return (
    <div>
      <Label name="LinkedIn" />
      <div className={`overflow-hidden rounded-lg border border-[#e0dfdc] bg-white ${large ? "" : "flex"}`}>
        {p.layout !== "none" && <Thumb p={p} className={large ? "aspect-[1.91/1] w-full" : "h-20 w-32 shrink-0"} />}
        <div className="min-w-0 px-3 py-2">
          <p className="line-clamp-2 text-sm font-semibold text-[#191919]">{p.title}</p>
          <p className="truncate text-xs text-[#666666]">{p.domain}</p>
        </div>
      </div>
    </div>
  );
}

function WhatsAppCard({ p }: { p: Preview }) {
  return (
    <div>
      <Label name="WhatsApp" />
      <div className="rounded-lg bg-[#d9fdd3] p-1.5">
        <div className={`overflow-hidden rounded-md bg-[#c8ecc3] ${p.layout === "large" ? "" : "flex"}`}>
          {p.layout !== "none" && <Thumb p={p} className={p.layout === "large" ? "aspect-[1.91/1] w-full" : "h-20 w-20 shrink-0"} />}
          <div className="min-w-0 px-2.5 py-1.5 text-sm">
            <p className="line-clamp-2 font-semibold text-[#111b21]">{p.title}</p>
            {p.description && <p className="line-clamp-2 text-xs text-[#54656f]">{p.description}</p>}
            <p className="truncate text-xs text-[#54656f]">{p.domain}</p>
          </div>
        </div>
        <p className="mt-1 break-all px-1 text-sm text-[#027eb5]">https://{p.domain}/…</p>
      </div>
    </div>
  );
}

export default function OpengraphAndMetaTagValidatorTool() {
  const uid = useId();
  const [url, setUrl] = useState(EXAMPLE_URL);
  const [status, setStatus] = useState<Status>("empty");
  const [data, setData] = useState<ResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (status !== "loading") return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const validate = async (target = url) => {
    if (target.trim() === "") {
      setStatus("error");
      setError("Enter the URL of the page you want to share, for example https://example.com/blog/post.");
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setElapsed(0);
    setNotice(null);
    setStatus("loading");
    const res = await postJson<ResponseData>(ENDPOINT, { url: target }, ctrl.signal);
    if (ctrl.signal.aborted) return;
    if (res.ok) {
      setData(res.data);
      setError(null);
      setStatus("done");
    } else {
      setError(res.message);
      setStatus("error");
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied.`);
    } catch {
      setNotice("Your browser blocked clipboard access. Select the text and copy it manually.");
    }
  };

  const counts = data ? { error: data.issues.filter((i) => i.severity === "error").length, warning: data.issues.filter((i) => i.severity === "warning").length } : null;
  const fixes = data ? fixSnippet(data) : "";

  return (
    <div className="space-y-6 text-navy">
      <section className={card} aria-labelledby={`${uid}-in`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-in`} className="text-lg font-semibold">Check a page</h2>
          <button type="button" className={btnSecondary} onClick={() => { setUrl(EXAMPLE_URL); void validate(EXAMPLE_URL); }}>Try an example</button>
        </div>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); void validate(); }}>
          <div className="flex-1">
            <label htmlFor={`${uid}-url`} className="block text-sm font-medium">Page URL</label>
            <input id={`${uid}-url`} type="text" inputMode="url" autoComplete="url" spellCheck={false} maxLength={2048} className={`${inputCls} mt-1`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/blog/my-post" />
          </div>
          <button type="submit" className={btnPrimary} disabled={status === "loading"}>Validate tags</button>
        </form>
        <p className="mt-2 text-xs text-slate-ink">Reads the page (first 2 MB) and its share image (up to 2 MB read; larger sizes come from the Content-Length header). 30 checks per 10 minutes. Use this tool only on pages you are allowed to test.</p>
      </section>

      <section className={card} aria-labelledby={`${uid}-out`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${uid}-out`} className="text-lg font-semibold">Report</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} disabled={!data || status !== "done"} onClick={() => data && copy(reportText(data), "Report")}>Copy report</button>
            <button type="button" className={btnSecondary} disabled={!data || status !== "done"} onClick={() => data && saveFile(JSON.stringify({ ...data, previews: undefined }, null, 2), "meta-tags.json", "application/json")}>Download JSON</button>
          </div>
        </div>
        <div aria-live="polite" className="mt-3 min-h-6 text-sm text-slate-ink">
          {status === "empty" && "Enter a URL or try the example to see the tag report and how the link will look when shared."}
          {status === "loading" && `Fetching the page and its image… ${elapsed} s`}
          {status === "done" && data && counts && `${counts.error} thing(s) to fix and ${counts.warning} to improve on ${data.finalUrl}.`}
          {notice && <span className="block text-navy">{notice}</span>}
        </div>
        {status === "loading" && (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Validating"><div className="h-full w-1/3 bg-primary motion-safe:animate-pulse" /></div>
            {elapsed >= 1 && <button type="button" className={btnSecondary} onClick={() => { abortRef.current?.abort(); setStatus(data ? "done" : "empty"); setNotice("Check cancelled."); }}>Cancel</button>}
          </div>
        )}
        {status === "error" && error && <div role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        <div className="mt-4 min-h-64">
          {status === "done" && data ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold">Link previews</h3>
                <p className="mt-1 text-xs text-slate-ink">Drawn here to show layout, text fallbacks and cropping. Each platform caches previews and changes its design, so the real result can differ.</p>
                <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2 [&>*]:min-w-0">
                  <FacebookCard p={data.previews.facebook} />
                  <XCard p={data.previews.x} />
                  <LinkedInCard p={data.previews.linkedin} />
                  <WhatsAppCard p={data.previews.whatsapp} />
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Fix-it checklist</h3>
                  {fixes && <button type="button" className={btnSecondary} onClick={() => copy(fixes, "Suggested tags")}>Copy suggested tags</button>}
                </div>
                <ul className="mt-2 space-y-2">
                  {data.issues.map((i, n) => (
                    <li key={n} className={`rounded-xl border p-3 text-sm ${SEVERITY[i.severity].cls}`}>
                      <p><strong>{SEVERITY[i.severity].label}</strong> <span className="text-xs">· {AREA[i.area]}</span>: {i.message}</p>
                      {i.fix && <pre className="mt-2 overflow-x-auto rounded-lg bg-white/70 p-2 font-mono text-xs">{i.fix}</pre>}
                    </li>
                  ))}
                </ul>
              </div>

              {data.image && (
                <div>
                  <h3 className="text-sm font-semibold">Share image</h3>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-2"><dt className="text-xs text-slate-ink">Size</dt><dd className="font-semibold">{data.image.width && data.image.height ? `${data.image.width}×${data.image.height}` : "unknown"}</dd></div>
                    <div className="rounded-xl bg-slate-50 p-2"><dt className="text-xs text-slate-ink">Format</dt><dd className="font-semibold uppercase">{data.image.type}</dd></div>
                    <div className="rounded-xl bg-slate-50 p-2"><dt className="text-xs text-slate-ink">File size</dt><dd className="font-semibold">{data.image.size !== null ? `${data.image.sizeAtLeast ? "> " : ""}${(data.image.size / 1024).toFixed(0)} KB` : "unknown"}</dd></div>
                    <div className="rounded-xl bg-slate-50 p-2"><dt className="text-xs text-slate-ink">Ratio</dt><dd className="font-semibold">{data.image.width && data.image.height ? `${(data.image.width / data.image.height).toFixed(2)}:1` : "–"}</dd></div>
                  </dl>
                  <p className="mt-1 break-all font-mono text-xs text-slate-ink">{data.image.url}</p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold">Tags found ({data.tags.raw.length})</h3>
                <div className="mt-2 max-h-96 overflow-auto rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50"><tr><th scope="col" className="border-b px-3 py-2 font-semibold">Tag</th><th scope="col" className="border-b px-3 py-2 font-semibold">Content</th></tr></thead>
                    <tbody>
                      {data.tags.raw.map((t, i) => (
                        <tr key={i} className="align-top"><td className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5 font-mono font-semibold">{t.key}</td><td className="break-all border-b border-slate-100 px-3 py-1.5">{t.value}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            status !== "loading" && <p className="text-sm text-slate-ink">Previews for Facebook, X, LinkedIn and WhatsApp and a checklist of fixes appear here.</p>
          )}
        </div>
      </section>
    </div>
  );
}
