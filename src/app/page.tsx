/**
 * Temporary Phase 0 landing. Replaced by the real homepage in Phase 2
 * (HeroSection, TrendingList, CategoryQuickNav, Latest Stories, ...).
 */
export default function Page() {
  return (
    <main className="site-container flex flex-1 flex-col items-center justify-center py-24 text-center">
      <p className="text-muted text-meta font-semibold tracking-[0.2em] uppercase">
        Phase 0 · Foundation
      </p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
        Viral<span className="text-brand">Trendly</span>
        <span className="text-ink">.com</span>
      </h1>
      <p className="text-muted mt-3 text-sm font-semibold tracking-[0.18em] uppercase">
        Trend Today. Talk Tomorrow.
      </p>
      <p className="text-muted mt-8 max-w-md text-base">
        Project scaffold is in place — design tokens, database schema, service
        layer and configuration. The homepage arrives in Phase 2.
      </p>
    </main>
  );
}
