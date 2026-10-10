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
        aria-label="Search PerkTonic"
        className="bg-canvas w-full max-w-2xl rounded-lg p-3 shadow-[var(--shadow-overlay)] sm:p-4"
      >
        {/* On narrow phones, icon + "Search PerkTonic..." placeholder +
            a text button + a close button left almost no room for the
            input itself (it was truncating after ~8 characters). Icon-only
            submit button + a shorter placeholder below `sm` fixes that
            without losing anything above it. */}
        <form onSubmit={submit} className="flex items-center gap-2 sm:gap-3">
          <SearchIcon
            width={20}
            height={20}
            className="text-muted hidden shrink-0 sm:block"
          />
          <input
            type="search"
            name="q"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search..."
            aria-label="Search query"
            className="text-ink placeholder:text-muted min-w-0 flex-1 bg-transparent py-2 text-base outline-none sm:text-lg"
          />
          <button
            type="submit"
            aria-label="Search"
            className="bg-ink hover:bg-ink-deep flex shrink-0 items-center gap-2 rounded-sm px-3 py-2 text-sm font-bold text-white transition-colors sm:px-4"
          >
            <SearchIcon width={16} height={16} className="sm:hidden" />
            <span className="hidden sm:inline">Search</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="text-muted hover:text-ink shrink-0 p-1 transition-colors"
          >
            <CloseIcon width={20} height={20} aria-hidden={false} />
          </button>
        </form>
      </div>
    </div>
  );
}
