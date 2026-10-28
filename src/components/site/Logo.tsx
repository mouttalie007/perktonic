import Link from "next/link";

/**
 * PerkTonic logo: the lightning-bolt mark (public/brand, 6 KB) + wordmark in
 * live text ("Perk" dark, "Tonic" blue). `onDark` flips the wordmark to white
 * for the footer.
 */
export function Logo({
  onDark = false,
  className = "",
}: {
  /** @deprecated kept for old call sites; the tagline now lives in the footer copy. */
  withTagline?: boolean;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="PerkTonic home"
      className={`group inline-flex items-center gap-2.5 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-mark-128.webp"
        alt=""
        width={40}
        height={40}
        className="h-9 w-9 sm:h-10 sm:w-10"
      />
      <span
        className={`font-heading text-[1.4rem] leading-none font-extrabold tracking-tight sm:text-[1.6rem] ${
          onDark ? "text-white" : "text-navy"
        }`}
      >
        Perk
        <span className={onDark ? "text-sky-400" : "text-primary"}>Tonic</span>
      </span>
    </Link>
  );
}
