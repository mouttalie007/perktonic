"use client";

import { useEffect, useState } from "react";
import { suggestInternalLinks, type LinkSuggestion } from "@/app/actions/admin-links";
import { Card } from "../ui";

const MIN_PARAGRAPHS = 3;

/**
 * "Suggested internal links" (per feedback): appears once the draft has 3+
 * paragraphs. Category/keyword-based suggestions (not AI) — each comes with
 * a ready <a> snippet; click Copy, then click in the editor and press
 * Ctrl+V to drop it in, the same gesture used for pasting images.
 */
export function InternalLinkSuggestions({
  categoryId,
  excludeId,
  paragraphCount,
}: {
  categoryId: string;
  excludeId?: string;
  paragraphCount: number;
}) {
  const active = paragraphCount >= MIN_PARAGRAPHS;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LinkSuggestion[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    suggestInternalLinks({ categoryId: categoryId || undefined, excludeId, query }).then((r) => {
      if (!cancelled) setResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [active, categoryId, excludeId, query]);

  if (!active) {
    return (
      <p className="text-muted text-xs">
        Suggested internal links will appear here once this draft has {MIN_PARAGRAPHS}+ paragraphs
        ({paragraphCount}/{MIN_PARAGRAPHS} so far).
      </p>
    );
  }

  async function copy(s: LinkSuggestion) {
    try {
      await navigator.clipboard.writeText(s.linkHtml);
      setCopiedId(s.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Suggested Internal Links</h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search articles…"
          className="border-line w-40 rounded-sm border px-2 py-1 text-xs"
        />
      </div>
      {results.length === 0 ? (
        <p className="text-muted text-xs">No matches yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {results.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{s.title}</span>
              <button
                type="button"
                onClick={() => copy(s)}
                className="border-line hover:bg-surface shrink-0 rounded-sm border px-2 py-1 text-xs font-bold transition-colors"
              >
                {copiedId === s.id ? "Copied!" : "Copy link"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted text-[0.7rem]">
        Copy a link, click where you want it in the editor, and press Ctrl+V.
      </p>
    </Card>
  );
}
