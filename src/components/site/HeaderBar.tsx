"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { NAV_PRIMARY, NAV_MORE, type SocialPlatform } from "@/config/site";
import { Logo } from "./Logo";
import { SearchIcon, MenuIcon, ChevronDownIcon } from "@/components/icons";
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
  const moreActive = NAV_MORE.some((i) => isActive(i.href));

  return (
    <header className="bg-canvas border-line border-b">
      <div className="site-container flex items-center justify-between gap-6 py-4">
        <Logo withTagline />

        {/* Desktop navigation */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-1 lg:flex"
        >
          {NAV_PRIMARY.map((item) => (
            <Link
              key={item.href}
              href={item.href as Route}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`relative px-3 py-2 text-[0.82rem] font-bold tracking-wide uppercase transition-colors after:absolute after:inset-x-3 after:-bottom-[1.05rem] after:h-[3px] after:transition-colors ${
                isActive(item.href)
                  ? "text-ink after:bg-brand"
                  : "text-ink/70 hover:text-ink after:bg-transparent"
              }`}
            >
              {item.label}
            </Link>
          ))}

          {/* MORE dropdown */}
          <div ref={moreRef} className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              className={`relative flex items-center gap-1 px-3 py-2 text-[0.82rem] font-bold tracking-wide uppercase transition-colors after:absolute after:inset-x-3 after:-bottom-[1.05rem] after:h-[3px] ${
                moreActive || moreOpen
                  ? "text-ink after:bg-brand"
                  : "text-ink/70 hover:text-ink after:bg-transparent"
              }`}
            >
              More
              <ChevronDownIcon
                width={14}
                height={14}
                className={moreOpen ? "rotate-180 transition-transform" : "transition-transform"}
              />
            </button>
            {moreOpen && (
              <div
                role="menu"
                aria-label="More categories"
                className="animate-slide-down border-line bg-canvas absolute right-0 top-[calc(100%+0.9rem)] z-[80] min-w-44 rounded-md border py-1 shadow-[var(--shadow-raised)]"
              >
                {NAV_MORE.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href as Route}
                    role="menuitem"
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`block px-4 py-2 text-[0.8rem] font-bold tracking-wide uppercase transition-colors ${
                      isActive(item.href)
                        ? "text-ink bg-surface"
                        : "text-ink/75 hover:bg-surface hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
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
