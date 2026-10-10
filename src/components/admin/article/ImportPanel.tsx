"use client";

import { useState } from "react";
import { parseMetaBlock, META_BLOCK_EXAMPLE, type ParsedArticleMeta } from "@/lib/article-import";
import { Button } from "../ui";

/**
 * "Import" tab (default, per feedback): paste two blocks — one with the
 * meta fields (title/slug/excerpt/SEO — a plain "Label: value" format,
 * documented below) and one with the full article body HTML — and fill the
 * whole form in one click. The normal manual-entry form (this same form,
 * pre-filled) stays exactly as it was.
 */
export function ImportPanel({
  onExtract,
}: {
  onExtract: (meta: ParsedArticleMeta, bodyHtml: string) => void;
}) {
  const [metaText, setMetaText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [showFormat, setShowFormat] = useState(false);
  const [lastResult, setLastResult] = useState<ParsedArticleMeta | null>(null);

  function extract() {
    const meta = parseMetaBlock(metaText);
    onExtract(meta, bodyText);
    setLastResult(meta);
  }

  return (
    <div className="border-line bg-surface/40 space-y-4 rounded-sm border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="import-meta" className="text-sm font-semibold">
              1. Title, SEO &amp; excerpt
            </label>
            <button
              type="button"
              onClick={() => setShowFormat((v) => !v)}
              className="text-accent-blue text-xs font-semibold hover:underline"
            >
              {showFormat ? "Hide format" : "Show format"}
            </button>
          </div>
          {showFormat && (
            <pre className="border-line bg-canvas text-muted mb-2 overflow-x-auto rounded-sm border p-2 text-[0.68rem] whitespace-pre-wrap">
              {META_BLOCK_EXAMPLE}
            </pre>
          )}
          <textarea
            id="import-meta"
            value={metaText}
            onChange={(e) => setMetaText(e.target.value)}
            rows={8}
            placeholder={"Title: …\nSlug: …\nExcerpt: …\nSEO Title: …\nMeta Description: …\nCategory: …\nAuthor: …\nTags: …"}
            className="border-line w-full rounded-sm border bg-white p-2 font-mono text-xs"
          />
        </div>

        <div>
          <label htmlFor="import-body" className="mb-1 block text-sm font-semibold">
            2. Full article HTML
          </label>
          <textarea
            id="import-body"
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={8}
            placeholder="<p>…</p><h2>…</h2><p>…</p>"
            className="border-line w-full rounded-sm border bg-white p-2 font-mono text-xs"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={extract} disabled={!metaText.trim() && !bodyText.trim()}>
          Extract &amp; fill the form below
        </Button>
        {lastResult && (
          <p className="text-muted text-xs">
            Filled: {[
              lastResult.title && "title",
              lastResult.slug && "slug",
              lastResult.excerpt && "excerpt",
              lastResult.seoTitle && "SEO title",
              lastResult.metaDescription && "meta description",
              lastResult.category && "category",
              lastResult.author && "author",
              lastResult.tags?.length && "tags",
            ]
              .filter(Boolean)
              .join(", ") || "nothing recognised — check the format"}
            . Review the fields below before publishing.
          </p>
        )}
      </div>
    </div>
  );
}
