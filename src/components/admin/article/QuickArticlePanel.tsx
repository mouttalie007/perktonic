"use client";

import { useEffect, useState } from "react";
import type { PromptQueueItem } from "@prisma/client";
import { getRandomPendingPrompt } from "@/app/actions/prompt-queue";
import { parseMetaBlock, type ParsedArticleMeta } from "@/lib/article-import";
import { splitQuickArticleOutput, INLINE_IMAGE_MARKER } from "@/lib/quick-article";
import { Button } from "../ui";

/**
 * "Quick Article" tab: copy a pre-written prompt, paste it into ChatGPT
 * (the editor's own subscription — no API costs, see project memory for
 * why this won out over a fully automated bot), paste the whole reply
 * back in one box, and the platform distributes every field to its place —
 * same mechanism as the Import tab, just a single combined paste instead
 * of two, plus the prompt is picked for you instead of written by hand.
 */
export function QuickArticlePanel({
  onExtract,
}: {
  onExtract: (meta: ParsedArticleMeta, bodyHtml: string, item: PromptQueueItem) => void;
}) {
  const [item, setItem] = useState<PromptQueueItem | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [outputText, setOutputText] = useState("");
  const [lastResult, setLastResult] = useState<ParsedArticleMeta | null>(null);

  async function loadNext() {
    setItem(undefined);
    setCopied(false);
    const next = await getRandomPendingPrompt();
    setItem(next);
  }

  useEffect(() => {
    // Fetching the first random prompt is a server round-trip, not a
    // derivable-from-props value — has to happen after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNext();
  }, []);

  async function copyPrompt() {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(item.promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the textarea fallback below still works */
    }
  }

  function extract() {
    if (!item) return;
    const { metaText, bodyHtml } = splitQuickArticleOutput(outputText);
    const meta = parseMetaBlock(metaText);
    // Only one description is requested from ChatGPT (spec: drop keywords,
    // keep it to one field) — use it for both the SEO meta tag and the
    // card excerpt rather than asking for a second, near-identical field.
    if (!meta.excerpt && meta.metaDescription) meta.excerpt = meta.metaDescription;
    onExtract(meta, bodyHtml, item);
    setLastResult(meta);
  }

  return (
    <div className="border-line bg-surface/40 space-y-4 rounded-sm border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">1. Copy a prompt</p>
          {item === undefined && <p className="text-muted text-xs">Picking a topic…</p>}
          {item === null && (
            <p className="text-accent-red text-xs font-semibold">
              No unused prompts left in the queue — every topic has been used.
            </p>
          )}
          {item && (
            <p className="text-muted text-xs">
              <span className="text-ink font-bold">{item.writerName}</span> · {item.category} ·{" "}
              <span className="italic">{item.title}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadNext}
            className="border-line text-ink hover:bg-surface rounded-sm border px-3 py-1.5 text-xs font-bold transition-colors"
          >
            🎲 Different topic
          </button>
          <Button type="button" onClick={copyPrompt} disabled={!item}>
            {copied ? "Copied!" : "Copy prompt"}
          </Button>
        </div>
      </div>

      <div>
        <label htmlFor="quick-output" className="mb-1 block text-sm font-semibold">
          2. Paste ChatGPT&apos;s full reply here
        </label>
        <textarea
          id="quick-output"
          value={outputText}
          onChange={(e) => setOutputText(e.target.value)}
          rows={10}
          placeholder={`Title: …\nSlug: …\nMeta Description: …\n---\n<p>…</p>`}
          className="border-line w-full rounded-sm border bg-white p-2 font-mono text-xs"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={extract} disabled={!item || !outputText.trim()}>
          Extract &amp; fill the form below
        </Button>
        {lastResult && (
          <p className="text-muted text-xs">
            Filled: {[lastResult.title && "title", lastResult.slug && "slug", lastResult.excerpt && "excerpt/description"]
              .filter(Boolean)
              .join(", ") || "nothing recognised — check the format"}
            . Category &amp; author were set automatically from the prompt.
          </p>
        )}
      </div>

      <p className="text-muted text-[0.7rem]">
        Tip: after filling the form, look for <code className="bg-canvas rounded-sm px-1">{INLINE_IMAGE_MARKER}</code> inside
        the article body below — click right there, paste your second image (Ctrl+V), then delete the marker text.
      </p>
    </div>
  );
}
