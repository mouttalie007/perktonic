/**
 * Home. Phase 1 ships the global chrome around a placeholder; the real
 * homepage (Hero, Trending, Category nav, Latest Stories, Popular Categories,
 * Newsletter) is built in Phase 2.
 */
export default function HomePage() {
  return (
    <div className="site-container py-20 text-center sm:py-28">
      <p className="text-muted text-meta font-semibold tracking-[0.2em] uppercase">
        Phase 1 · Global chrome
      </p>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
        The shell is in place
      </h1>
      <p className="text-muted mx-auto mt-4 max-w-md text-base">
        Utility bar, header, navigation, mobile menu, search overlay and footer
        are live. The homepage content arrives in Phase 2.
      </p>
    </div>
  );
}
