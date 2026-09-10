"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { SearchIcon, CloseIcon } from "@/components/icons";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

/**
 * Global search overlay (spec §29). Phase 1 ships the shell: it captures a
 * query and routes to /search?q=… (results page arrives in Phase 5).
 */
export function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const router = useRouter();

  useBodyScrollLock(open);
  useFocusTrap(panelRef, open, onClose);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = value.trim();
      if (!q) return;
      router.push(`/search?q=${encodeURIComponent(q)}` as Route);
      setValue("");
      onClose();
    },
    [value, router, onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search ViralTrendly"
        className="bg-canvas w-full max-w-2xl rounded-lg p-4 shadow-[var(--shadow-overlay)]"
      >
        <form onSubmit={submit} className="flex items-center gap-3">
          <SearchIcon
            width={22}
            height={22}
            className="text-muted shrink-0"
          />
          <input
            type="search"
            name="q"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search ViralTrendly..."
            aria-label="Search query"
            className="text-ink placeholder:text-muted min-w-0 flex-1 bg-transparent py-2 text-lg outline-none"
          />
          <button
            type="submit"
            className="bg-ink hover:bg-ink-deep rounded-sm px-4 py-2 text-sm font-bold text-white transition-colors"
          >
            Search
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="text-muted hover:text-ink p-1 transition-colors"
          >
            <CloseIcon width={22} height={22} aria-hidden={false} />
          </button>
        </form>
      </div>
    </div>
  );
}
