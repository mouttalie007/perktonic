import Link from "next/link";
import type { Route } from "next";
import { POPULAR_SEARCHES } from "@/config/tools";
import { SearchIcon } from "@/components/icons";

/**
 * Homepage hero: badge, headline, search box + popular searches, and the 3D
 * illustration (desktop: laptop scene; phones: the small floating-tiles
 * cluster). Images are hand-sized WebP files in public/brand, with explicit
 * dimensions so there's no layout shift.
 */
export function HomeHero() {
  return (
    <section className="from-hero-wash relative overflow-hidden bg-gradient-to-b to-white">
      <div className="site-container relative grid grid-cols-1 items-center gap-6 pt-6 pb-8 sm:pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-4 lg:pt-14 lg:pb-12">
        <div className="relative z-10 min-w-0">
          <span className="text-navy inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3.5 py-1.5 text-[0.8rem] font-semibold shadow-sm">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              aria-hidden
              className="text-primary"
            >
              <path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor" />
            </svg>
            Free Online Tools for Smarter Workflows
          </span>

          <h1 className="font-heading text-navy mt-4 text-[clamp(1.45rem,6.5vw,1.9rem)] leading-[1.1] font-extrabold tracking-tight sm:mt-5 sm:text-5xl lg:text-[3.3rem]">
            Powerful Online Tools
            <span className="block">
              for <span className="text-primary">Work, Data &amp;</span>
            </span>
            <span className="text-primary block">Productivity</span>
          </h1>

          <p className="text-slate-ink mt-4 max-w-xl text-[0.98rem] leading-relaxed sm:mt-5 sm:text-lg">
            Explore a growing collection of free, fast and easy-to-use tools to
            work with spreadsheets, data, documents, automation and web
            utilities — all in one place.
          </p>

          <form
            action="/search"
            method="get"
            role="search"
            className="mt-7 max-w-[41rem]"
          >
            <div className="focus-within:border-primary/50 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[var(--shadow-soft)] focus-within:ring-4 focus-within:ring-blue-100">
              <SearchIcon
                width={20}
                height={20}
                className="ml-3 shrink-0 text-slate-400"
              />
              <label htmlFor="hero-search" className="sr-only">
                Search for a tool
              </label>
              <input
                id="hero-search"
                name="q"
                type="search"
                autoComplete="off"
                placeholder="Search for a tool… (e.g. PDF to Excel)"
                className="text-navy min-w-0 flex-1 bg-transparent px-1 py-2.5 text-[0.95rem] outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="bg-primary hover:bg-primary-dark shrink-0 rounded-xl px-5 py-2.5 text-[0.95rem] font-bold text-white transition-colors sm:px-8"
              >
                Search
              </button>
            </div>
          </form>

          <div className="mt-4 flex items-center gap-2.5 sm:flex-wrap">
            <span className="text-navy shrink-0 text-[0.82rem] font-semibold">
              Popular searches:
            </span>
            <ul className="-mr-4 flex min-w-0 [scrollbar-width:none] gap-2 overflow-x-auto pr-4 sm:mr-0 sm:flex-wrap sm:overflow-visible sm:pr-0 [&::-webkit-scrollbar]:hidden">
              {POPULAR_SEARCHES.map((q) => (
                <li key={q} className="shrink-0">
                  <Link
                    href={`/search?q=${encodeURIComponent(q)}` as Route}
                    className="text-primary hover:bg-primary bg-primary-soft inline-block rounded-full px-3.5 py-1.5 text-[0.8rem] font-medium transition-colors hover:text-white"
                  >
                    {q}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Desktop / tablet illustration */}
        <div className="relative hidden lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/hero-desktop-900.webp"
            srcSet="/brand/hero-desktop-900.webp 900w, /brand/hero-desktop-1500.webp 1500w"
            sizes="(min-width: 1320px) 660px, 50vw"
            width={1500}
            height={750}
            alt="PerkTonic tools: Excel & Sheets, PDF tools, data converters, automation and web diagnostics around a laptop"
            fetchPriority="high"
            decoding="async"
            className="h-auto w-full"
          />
        </div>

        {/* Phone illustration, tucked into the top-right corner */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/hero-mobile-420.webp"
          srcSet="/brand/hero-mobile-420.webp 420w, /brand/hero-mobile-640.webp 640w"
          sizes="(min-width: 640px) 224px, 28vw"
          width={640}
          height={545}
          alt=""
          aria-hidden
          fetchPriority="high"
          decoding="async"
          className="pointer-events-none absolute top-[3.6rem] -right-1 h-auto w-[28vw] max-w-[9.5rem] sm:top-12 sm:right-8 sm:w-56 sm:max-w-none lg:hidden"
        />
      </div>
    </section>
  );
}
