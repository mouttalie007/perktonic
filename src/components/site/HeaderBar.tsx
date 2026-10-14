"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { NAV_PRIMARY, NAV_MORE, type SocialPlatform } from "@/config/site";
import { Logo } from "./Logo";
import { SearchIcon, MenuIcon, ChevronDownIcon } from "@/components/icons";
import { CategoryIcon } from "@/components/CategoryIcon";
import { MobileNav } from "./MobileNav";
import { SearchOverlay } from "./SearchOverlay";

/**
 * Main header (spec §7, §8). Client island: active-link highlighting,
 * MORE dropdown, mobile menu and search overlay. Desktop nav is horizontal;
 * on < lg it collapses to a hamburger (never a squeezed desktop nav).
 */
export function HeaderBar({
  social,
}: {
  social: Partial<Record<SocialPlatform, string>>;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close everything on navigation — adjust state during render (React docs
  // pattern), not in an effect.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
    setMoreOpen(false);
  }

  // Close the MORE dropdown on outside click / Escape.
  useEffect(() => {
    if (!moreOpen) return;
    function onDown(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const activeMoreItem = NAV_MORE.find((i) => isActive(i.href));
  const moreActive = Boolean(activeMoreItem);
  const moreAccent = activeMoreItem?.accentColor ?? "var(--color-brand)";

  return (
    <header className="bg-canvas border-line border-b">
      <div className="site-container flex items-center justify-between gap-3 py-4 xl:gap-6" data-nosnippet>
        <Logo withTagline />

        {/* Desktop navigation */}
        <nav
          aria-label="Primary"
          className="hidden min-w-0 items-center lg:flex"
        >
          {NAV_PRIMARY.map((item) => {
            const active = isActive(item.href);
            const accent = item.accentColor ?? "var(--color-brand)";
            return (
              <Link
                key={item.href}
                href={item.href as Route}
                aria-current={active ? "page" : undefined}
                className="group relative flex items-center gap-1.5 px-2 py-2 text-[0.75rem] font-bold uppercase xl:px-3 xl:text-[0.82rem] xl:tracking-wide"
              >
                {/* Icons only from xl — at lg (1024-1279px) 8 items + MORE
                    plus icons overflowed the header by ~9px (found via the
                    responsive audit, the same "nav vs logo" squeeze as the
                    original Phase 1 1024px fix). */}
                <CategoryIcon
                  iconKey={item.iconKey}
                  width={15}
                  height={15}
                  className="hidden shrink-0 opacity-60 transition-[color,opacity,transform] duration-200 group-hover:scale-110 group-hover:opacity-100 xl:inline"
                  style={{ color: active ? accent : undefined }}
                />
                <span
                  className={`transition-colors duration-200 ${active ? "text-ink" : "text-ink/70 group-hover:text-ink"}`}
                >
                  {item.label}
                </span>
                <span
                  aria-hidden
                  className={`absolute inset-x-2 -bottom-[1.05rem] h-[3px] rounded-full transition-opacity duration-200 xl:inset-x-3 ${
                    active ? "opacity-100" : "opacity-0 group-hover:opacity-40"
                  }`}
                  style={{ background: accent }}
                />
              </Link>
            );
          })}

          {/* MORE dropdown — hidden entirely when there's nothing to put in it
              (all categories fit in the primary bar, as of the PerkTonic pivot) */}
          {NAV_MORE.length > 0 && (
          <div ref={moreRef} className="group relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              className={`relative flex items-center gap-1 px-2 py-2 text-[0.75rem] font-bold uppercase transition-colors xl:px-3 xl:text-[0.82rem] xl:tracking-wide ${
                moreActive || moreOpen ? "text-ink" : "text-ink/70 hover:text-ink"
              }`}
            >
              More
              <ChevronDownIcon
                width={14}
                height={14}
                className={`transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`}
              />
              <span
                aria-hidden
                className={`absolute inset-x-2 -bottom-[1.05rem] h-[3px] rounded-full transition-opacity duration-200 xl:inset-x-3 ${
                  moreActive ? "opacity-100" : "opacity-0 group-hover:opacity-40"
                }`}
                style={{ background: moreAccent }}
              />
            </button>
            {moreOpen && (
              <div
                role="menu"
                aria-label="More categories"
                className="animate-slide-down border-line bg-canvas absolute right-0 top-[calc(100%+0.9rem)] z-[80] min-w-48 origin-top-right rounded-md border py-1.5 shadow-[var(--shadow-raised)]"
              >
                {NAV_MORE.map((item) => {
                  const active = isActive(item.href);
                  const accent = item.accentColor ?? "var(--color-brand)";
                  return (
                    <Link
                      key={item.href}
                      href={item.href as Route}
                      role="menuitem"
                      aria-current={active ? "page" : undefined}
                      className={`group/item flex items-center gap-2.5 border-l-2 px-4 py-2 text-[0.8rem] font-bold tracking-wide uppercase transition-colors duration-150 ${
                        active ? "bg-surface text-ink" : "text-ink/75 hover:bg-surface hover:text-ink border-transparent"
                      }`}
                      style={{ borderLeftColor: active ? accent : undefined }}
                    >
                      <CategoryIcon
                        iconKey={item.iconKey}
                        width={15}
                        height={15}
                        className="shrink-0 opacity-60 transition-[color,opacity] duration-150 group-hover/item:opacity-100"
                        style={{ color: active ? accent : undefined }}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          )}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Open search"
            className="text-ink hover:bg-surface rounded-sm p-2 transition-colors"
          >
            <SearchIcon width={20} height={20} aria-hidden={false} />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="text-ink hover:bg-surface rounded-sm p-2 transition-colors lg:hidden"
          >
            <MenuIcon width={22} height={22} aria-hidden={false} />
          </button>
        </div>
      </div>

      <MobileNav
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        pathname={pathname}
        social={social}
      />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
