"use client";

import { useEffect, useRef, type ReactNode } from "react";

const TEXT_INPUT_TYPES = new Set(["text", "url", "search"]);

/**
 * Frame around the interactive part of a tool page. Tools open on a sample (so the
 * result is never an empty box); to replace it, the first click into a field that
 * came with sample text selects all of it, so pasting or typing overwrites the sample.
 * Fields the visitor filled later are left alone.
 */
export function ToolStage({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const sample = new WeakSet<Element>();
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("textarea, input").forEach((el) => {
      const textual = el instanceof HTMLTextAreaElement || TEXT_INPUT_TYPES.has(el.type);
      if (textual && !el.readOnly && el.value !== "") sample.add(el);
    });
    const selectSample = (el: HTMLInputElement | HTMLTextAreaElement) => {
      sample.delete(el);
      // Safari clears the selection when the mouse button is released, so swallow that one event.
      el.addEventListener("mouseup", (ev) => ev.preventDefault(), { once: true });
      // After the click has placed the caret.
      // A tool that already selected a range itself (for example "Show in the contract") keeps it.
      setTimeout(() => {
        if (el.selectionStart === el.selectionEnd) el.select();
      }, 0);
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) if (sample.has(el)) selectSample(el);
    };
    // A visitor who clicked in before the page finished loading is already inside a sample field.
    const active = document.activeElement;
    if ((active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) && sample.has(active)) selectSample(active);
    root.addEventListener("focusin", onFocusIn);
    return () => root.removeEventListener("focusin", onFocusIn);
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
