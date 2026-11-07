"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Route } from "next";
import { CATEGORIES, NAV_LINKS } from "@/config/site";
import { ArrowRightIcon, BookIcon, CloseIcon, HomeIcon, InfoIcon, WrenchIcon } from "@/components/icons";
import { Logo } from "./Logo";
import { ToolIcon } from "./ToolIcon";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

/** A small coloured icon tile for each main link of the menu. */
const NAV_ICON: Record<string, { Icon: typeof HomeIcon; tile: string }> = {
  "/": { Icon: HomeIcon, tile: "bg-blue-50 text-blue-600" },
  "/tools": { Icon: WrenchIcon, tile: "bg-amber-50 text-amber-600" },
  "/blog": { Icon: BookIcon, tile: "bg-violet-50 text-violet-600" },
  "/about": { Icon: InfoIcon, tile: "bg-emerald-50 text-emerald-600" },
};

/**
 * Slide-in mobile menu: accessible dialog (focus trap, Escape, scroll lock).
 */
export function MobileNav({
  open,
  onClose,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(open);
  useFocusTrap(panelRef, open, onClose);

  if (!open) return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Rendered on <body>: the header has backdrop-filter, which makes it the containing block of any
  // fixed child and would shrink the overlay to the header's box.
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[110] bg-slate-900/50 lg:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        className="animate-slide-in-right ml-auto flex h-full w-[min(21rem,88vw)] flex-col overflow-y-auto bg-white"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="text-navy -mr-1 p-1"
          >
            <CloseIcon width={24} height={24} aria-hidden={false} />
          </button>
        </div>

        <nav aria-label="Primary" className="flex flex-col px-3 py-3">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href as Route}
              onClick={onClose}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-semibold ${
                isActive(item.href)
                  ? "bg-primary-soft text-primary"
                  : "text-navy hover:bg-slate-50"
              }`}
            >
              {NAV_ICON[item.href] && (
                <span
                  aria-hidden
                  className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${NAV_ICON[item.href].tile}`}
                >
                  {(() => {
                    const { Icon } = NAV_ICON[item.href];
                    return <Icon width={19} height={19} />;
                  })()}
                </span>
              )}
              {item.label}
            </Link>
          ))}

          <span className="mt-4 px-3 pb-1 text-xs font-bold tracking-[0.16em] text-slate-500 uppercase">
            Categories
          </span>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}` as Route}
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50"
            >
              <ToolIcon kind={c.iconKey} category={c.slug} size={36} className="!rounded-xl" />
              <span className="text-navy text-[0.95rem] font-semibold">
                {c.name}
              </span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t border-slate-200 p-5">
          <Link
            href={"/tools" as Route}
            onClick={onClose}
            className="bg-primary hover:bg-primary-dark flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white"
          >
            Browse All Tools
            <ArrowRightIcon width={16} height={16} />
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
