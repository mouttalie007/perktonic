"use client";

import { useEffect, useState } from "react";
import { ArrowUpIcon } from "@/components/icons";
// Side-effect only: disables Zod's eval-probe before any form on the page
// can trigger it. See src/lib/zod-config.ts for why.
import "@/lib/zod-config";

const SHOW_AFTER_PX = 600;

/**
 * Floating "back to top" button, site-wide (2026-10-10) — rendered once in
 * the root layout so it's on every page, public and admin alike, not a
 * per-page concern like the cookie banner.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className="bg-ink hover:bg-ink-deep fixed right-5 bottom-5 z-40 flex h-11 w-11 items-center justify-center rounded-full text-white shadow-[var(--shadow-raised)] transition-colors"
    >
      <ArrowUpIcon width={20} height={20} />
    </button>
  );
}
