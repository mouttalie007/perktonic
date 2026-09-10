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
 * When nothing resolves: renders a dashed dev placeholder (so layout can be
 * reviewed) and nothing at all in production.
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

  if (!ad) {
    if (process.env.NODE_ENV !== "development") return null;
    return (
      <div
        style={reserve}
        className={`ad-reserve border-line text-muted flex items-center justify-center rounded-sm border border-dashed bg-[var(--color-surface)] text-[0.7rem] font-semibold tracking-wider uppercase ${className}`}
      >
        Ad slot · {def?.label ?? placement} · inactive
      </div>
    );
  }

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
