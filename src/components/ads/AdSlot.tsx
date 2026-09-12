import { adService } from "@/services/ad.service";
import { AD_LABEL, AD_PLACEMENTS, type AdPlacementKey } from "@/config/ads";
import { AdUnitRender } from "./AdUnitRender";

/**
 * A template ad slot (spec §11, §16, §46). Server component:
 *  - resolves the placement -> AdUnit through adService (respects the global
 *    kill switch, per-article overrides and device flags)
 *  - reserves height to avoid CLS
 *  - clearly labels the container "Advertisement" — never dressed as content
 *
 * Renders nothing at all — in every environment — until a real Ad Unit is
 * mapped to this placement in the admin (user feedback, 2026-09-12: the dev
 * "inactive" placeholder was visible on the live site and looked like a
 * broken ad, not a review aid).
 */
export async function AdSlot({
  placement,
  article,
  className = "",
}: {
  placement: AdPlacementKey;
  article?: {
    adsDisabled?: boolean;
    adOverrides?: Record<string, string | null> | null;
  } | null;
  className?: string;
}) {
  const ad = await adService.resolve(placement, article);
  const def = AD_PLACEMENTS.find((p) => p.key === placement);
  const reserve = {
    "--ad-h-d": `${ad?.reservedHeightDesktop ?? def?.reservedHeight.desktop ?? 0}px`,
    "--ad-h-m": `${ad?.reservedHeightMobile ?? def?.reservedHeight.mobile ?? 0}px`,
  } as React.CSSProperties;

  if (!ad) return null;

  const deviceClass = [
    ad.showMobile ? "" : "max-lg:hidden",
    ad.showDesktop ? "" : "lg:hidden",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside
      aria-label="Advertisement"
      style={reserve}
      className={`ad-reserve flex flex-col items-center bg-[var(--color-surface)] py-2 ${deviceClass} ${className}`}
    >
      <span className="text-muted mb-1 text-[0.6rem] font-semibold tracking-[0.15em] uppercase">
        {AD_LABEL}
      </span>
      <AdUnitRender code={ad.code} />
    </aside>
  );
}
