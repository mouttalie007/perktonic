"use client";

import { useRef } from "react";
import Link from "next/link";
import type { Route } from "next";
import { NAV_PRIMARY, NAV_MORE, type SocialPlatform, type NavItem } from "@/config/site";
import { CloseIcon } from "@/components/icons";
import { CategoryIcon } from "@/components/CategoryIcon";
import { SocialLinks } from "./SocialLinks";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

/**
 * Slide-in mobile navigation (spec §8). Intentional mobile UX — not a
 * squeezed desktop nav. Accessible: labelled dialog, focus trap, Escape to
 * close, body scroll lock, focus restored on close.
 */
export function MobileNav({
  open,
  onClose,
  pathname,
  social,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
  social: Partial<Record<SocialPlatform, string>>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(open);
  useFocusTrap(panelRef, open, onClose);

  if (!open) return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[110] bg-black/50 lg:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        className="animate-slide-in-right bg-canvas ml-auto flex h-full w-[min(20rem,85vw)] flex-col overflow-y-auto"
      >
        <div className="border-line flex items-center justify-between border-b px-5 py-4">
          <span className="text-meta text-muted font-bold tracking-[0.2em] uppercase">
            Menu
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="text-ink -mr-1 p-1"
          >
            <CloseIcon width={24} height={24} aria-hidden={false} />
          </button>
        </div>

        <nav aria-label="Primary" className="flex flex-col px-2 py-3">
          {NAV_PRIMARY.map((item, i) => (
            <MobileNavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              delay={i}
              onClick={onClose}
            />
          ))}

          <span className="text-meta text-muted mt-3 px-3 pb-1 font-bold tracking-[0.2em] uppercase">
            More
          </span>
          {NAV_MORE.map((item, i) => (
            <MobileNavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              delay={NAV_PRIMARY.length + i}
              onClick={onClose}
            />
          ))}
        </nav>

        <div className="border-line mt-auto flex flex-col gap-3 border-t px-5 py-4">
          <SocialLinks
            links={social}
            size={18}
            linkClassName="text-muted hover:text-ink"
          />
        </div>
      </div>
    </div>
  );
}

/** One row: icon tinted + left accent bar when active, staggered fade-in on open. */
function MobileNavLink({
  item,
  active,
  delay,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  delay: number;
  onClick: () => void;
}) {
  const accent = item.accentColor ?? "var(--color-brand)";
  return (
    <Link
      href={item.href as Route}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      style={{
        animationDelay: `${Math.min(delay, 10) * 25}ms`,
        borderLeftColor: active ? accent : undefined,
      }}
      className={`animate-nav-item-in flex items-center gap-3 rounded-sm border-l-2 px-3 py-2.5 text-[0.95rem] font-semibold opacity-0 transition-colors ${
        active ? "bg-surface text-ink" : "text-ink/80 hover:bg-surface border-transparent"
      }`}
    >
      <CategoryIcon
        iconKey={item.iconKey}
        width={18}
        height={18}
        className="shrink-0 opacity-70"
        style={{ color: active ? accent : undefined }}
      />
      {item.label}
    </Link>
  );
}
