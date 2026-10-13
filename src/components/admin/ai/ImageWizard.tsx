"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  attachSlotImageAction,
  getWizardDataAction,
  type WizardData,
} from "@/app/actions/admin-ai-articles";
import { Button } from "../ui";

interface Props {
  briefId: string;
  onClose: () => void;
  /** Called after every successful paste so the board's counters stay fresh. */
  onChanged: () => void;
}

const KIND_LABEL = {
  cover: "Featured image (top of the article and in lists)",
  photo: "Photo",
  screenshot: "Screenshot — capture this one by hand",
} as const;

/**
 * The "Images" popup of an API article: one step per image (featured image
 * first, then every [IMAGE] tag in order). Click the prompt to copy it,
 * make the image, press Ctrl+V anywhere in the popup — it's uploaded,
 * compressed to WebP (same pipeline as every upload) and put in its place.
 * There is deliberately no "choose a file" control: paste only.
 */
export function ImageWizard({ briefId, onClose, onChanged }: Props) {
  const [data, setData] = useState<WizardData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const indexRef = useRef(0);
  const busyRef = useRef(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // Load the slots and resume at the first image still missing.
  useEffect(() => {
    let cancelled = false;
    getWizardDataAction(briefId)
      .then((d) => {
        if (cancelled) return;
        if (!d) {
          setLoadFailed(true);
          return;
        }
        setData(d);
        const firstMissing = d.slots.findIndex((s) => !s.url);
        setIndex(firstMissing >= 0 ? firstMissing : 0);
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
  }, [briefId]);

  const upload = useCallback(
    async (file: File) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setUploading(true);
      setError(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await attachSlotImageAction(briefId, indexRef.current, fd);
        if (res.ok) {
          setData((d) => (d ? { ...d, slots: res.slots } : d));
          onChanged();
        } else {
          setError(res.error);
        }
      } catch {
        setError("The upload failed. Check your connection and paste again.");
      } finally {
        busyRef.current = false;
        setUploading(false);
      }
    },
    [briefId, onChanged],
  );

  // Ctrl+V anywhere in the popup.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find(
        (it) => it.kind === "file" && it.type.startsWith("image/"),
      );
      const file = imageItem?.getAsFile();
      if (!file) {
        setError(
          "There's no image on the clipboard. Copy the image first, then press Ctrl+V.",
        );
        return;
      }
      e.preventDefault();
      void upload(file);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("paste", onPaste);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("keydown", onKey);
    };
  }, [upload, onClose]);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const slot = data?.slots[index];
  const total = data?.slots.length ?? 0;
  const isLast = index === total - 1;
  const doneCount = data?.slots.filter((s) => s.url).length ?? 0;

  function go(to: number) {
    setError(null);
    setCopied(false);
    setIndex(to);
  }

  async function copyPrompt() {
    if (!slot) return;
    try {
      await navigator.clipboard.writeText(slot.prompt);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      setError(
        "The browser blocked copying. Select the text and copy it by hand.",
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add the article's images"
    >
      <div className="bg-canvas flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl shadow-xl">
        <div className="border-line flex items-start justify-between gap-4 border-b px-6 py-4">
          <div className="min-w-0">
            <p className="text-muted text-xs font-bold tracking-wide uppercase">
              Images
            </p>
            <h2 className="truncate text-base font-extrabold">
              {data?.title ?? "Loading…"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink -mt-1 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {loadFailed && (
          <p className="text-accent-red p-6 text-sm font-semibold">
            Couldn&apos;t load this article&apos;s images. Close this and try
            again.
          </p>
        )}

        {slot && (
          <>
            <div className="overflow-y-auto px-6 py-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-bold">
                  Image {index + 1} of {total}
                  <span className="text-muted ml-2 font-semibold">
                    ({doneCount} done)
                  </span>
                </p>
                <div className="flex gap-1" aria-hidden>
                  {data!.slots.map((s, i) => (
                    <span
                      key={i}
                      className={`h-2 w-6 rounded-full ${
                        i === index
                          ? "bg-ink"
                          : s.url
                            ? "bg-green-600"
                            : "bg-line"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <p className="text-brand-ink mb-2 text-xs font-bold tracking-wide uppercase">
                {KIND_LABEL[slot.kind]}
              </p>

              <button
                type="button"
                onClick={copyPrompt}
                className="border-line hover:border-ink bg-surface group relative block w-full cursor-pointer rounded-md border p-4 text-left transition-colors"
                title="Click to copy"
              >
                <span className="block max-h-56 overflow-y-auto pr-24 text-sm leading-relaxed whitespace-pre-wrap">
                  {slot.prompt}
                </span>
                <span
                  className={`absolute top-3 right-3 rounded-sm px-2.5 py-1 text-xs font-bold ${
                    copied
                      ? "bg-green-600 text-white"
                      : "bg-ink group-hover:bg-ink-deep text-white"
                  }`}
                >
                  {copied
                    ? "Copied ✓"
                    : slot.kind === "screenshot"
                      ? "Copy steps"
                      : "Copy prompt"}
                </span>
              </button>

              <div
                className={`mt-4 flex min-h-44 flex-col items-center justify-center rounded-md border-2 border-dashed p-4 text-center ${
                  slot.url ? "border-green-600 bg-green-50" : "border-line"
                }`}
              >
                {uploading ? (
                  <p className="text-muted text-sm font-semibold">
                    Uploading and compressing…
                  </p>
                ) : slot.url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slot.url}
                      alt={slot.alt}
                      className="max-h-40 rounded-sm object-contain"
                    />
                    <p className="mt-2 text-sm font-bold text-green-800">
                      Saved ✓ — press Ctrl+V to replace it
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold">
                      Press Ctrl+V to paste the image
                    </p>
                    <p className="text-muted mt-1 text-xs">
                      Copy the picture first. It&apos;s converted to WebP and
                      compressed automatically.
                    </p>
                  </>
                )}
              </div>

              {error && (
                <p
                  role="alert"
                  className="bg-accent-red/10 text-accent-red mt-3 rounded-sm p-3 text-sm font-semibold"
                >
                  {error}
                </p>
              )}
            </div>

            <div className="border-line flex items-center justify-between gap-3 border-t px-6 py-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => go(index - 1)}
                disabled={index === 0 || uploading}
              >
                Back
              </Button>
              <div className="flex items-center gap-3">
                {!slot.url && !isLast && (
                  <button
                    type="button"
                    onClick={() => go(index + 1)}
                    className="text-muted hover:text-ink text-xs font-semibold underline"
                  >
                    Skip this one
                  </button>
                )}
                {isLast ? (
                  <Button type="button" onClick={onClose} disabled={uploading}>
                    Done
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => go(index + 1)}
                    disabled={!slot.url || uploading}
                  >
                    Next
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
