"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { CATEGORIES, NAV_LINKS } from "@/config/site";
import { Logo } from "./Logo";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  MenuIcon,
  SearchIcon,
} from "@/components/icons";
import { MobileNav } from "./MobileNav";
import { SearchOverlay } from "./SearchOverlay";
import { ToolIcon } from "./ToolIcon";

/**
 * Main header (2026-10-29 redesign): logo, Home / Tools / Categories ▾ / Blog /
 * About, search, and the "Browse All Tools" call to action. Client island for
 * active-link state, the Categories dropdown, the mobile menu and search.
 */
export function HeaderBar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const catsRef = useRef<HTMLDivElement>(null);

  // Close everything on navigation (adjust state during render, React docs pattern).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
    setCatsOpen(false);
  }

  useEffect(() => {
    if (!catsOpen) return;
    function onDown(e: MouseEvent) {
      if (catsRef.current && !catsRef.current.contains(e.target as Node))
        setCatsOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCatsOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [catsOpen]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const catsActive = pathname.startsWith("/category/");

  const linkBase =
    "relative px-1 py-2 text-[0.95rem] font-semibold transition-colors after:absolute after:inset-x-1 after:-bottom-[1.05rem] after:h-0.5 after:rounded-full after:bg-primary after:transition-opacity";

  return (
    <header className="sticky top-0 z-[100] border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="site-container flex h-[4.25rem] items-center justify-between gap-4">
        <div className="flex items-center gap-8 xl:gap-12">
          <Logo />

          <nav
            aria-label="Primary"
            className="hidden items-center gap-6 lg:flex xl:gap-8"
          >
            {NAV_LINKS.slice(0, 2).map((item) => (
              <Link
                key={item.href}
                href={item.href as Route}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`${linkBase} ${
                  isActive(item.href)
                    ? "text-primary after:opacity-100"
                    : "text-navy/80 hover:text-navy after:opacity-0 hover:after:opacity-30"
                }`}
              >
                {item.label}
              </Link>
            ))}

            <div ref={catsRef} className="relative">
              <button
                type="button"
                onClick={() => setCatsOpen((v) => !v)}
                aria-expanded={catsOpen}
                aria-haspopup="menu"
                className={`${linkBase} inline-flex items-center gap-1 ${
                  catsActive || catsOpen
                    ? "text-primary after:opacity-100"
                    : "text-navy/80 hover:text-navy after:opacity-0 hover:after:opacity-30"
                }`}
              >
                Categories
                <ChevronDownIcon
                  width={15}
                  height={15}
                  className={`transition-transform duration-200 ${catsOpen ? "rotate-180" : ""}`}
                />
              </button>
              {catsOpen && (
                <div
                  role="menu"
                  className="absolute top-full left-0 z-[200] mt-4 w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-[var(--shadow-soft-hover)]"
                >
                  {CATEGORIES.map((c) => (
                    <Link
                      key={c.slug}
                      role="menuitem"
                      href={`/category/${c.slug}` as Route}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50"
                    >
                      <ToolIcon
                        kind={c.iconKey}
                        category={c.slug}
                        size={36}
                        className="!rounded-xl"
                      />
                      <span className="text-navy text-sm font-semibold">
                        {c.name}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {NAV_LINKS.slice(2).map((item) => (
              <Link
                key={item.href}
                href={item.href as Route}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`${linkBase} ${
                  isActive(item.href)
                    ? "text-primary after:opacity-100"
                    : "text-navy/80 hover:text-navy after:opacity-0 hover:after:opacity-30"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="text-navy hover:bg-primary-soft flex h-10 w-10 items-center justify-center rounded-full transition-colors"
          >
            <SearchIcon width={20} height={20} />
          </button>
          <Link
            href={"/tools" as Route}
            className="bg-primary hover:bg-primary-dark hidden items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-colors lg:inline-flex"
          >
            Browse All Tools
            <ArrowRightIcon width={16} height={16} />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="text-navy hover:bg-primary-soft flex h-10 w-10 items-center justify-center rounded-full transition-colors lg:hidden"
          >
            <MenuIcon width={22} height={22} />
          </button>
        </div>
      </div>

      <MobileNav
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        pathname={pathname}
      />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
