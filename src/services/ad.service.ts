import { prisma } from "@/lib/prisma";
import { ADSENSE, AD_PLACEMENTS, type AdPlacementKey } from "@/config/ads";

/**
 * Resolves which ad markup (if any) to render in a given template slot
 * (spec §46). Resolution order:
 *   1. global kill switch (ADSENSE.enabled)
 *   2. per-article `adsDisabled`
 *   3. per-article `adOverrides[placementKey]` (an AdUnit id, or null = off)
 *   4. global AdPlacement -> AdUnit mapping
 * Then device visibility flags on the AdUnit decide client-side rendering.
 */

export interface ResolvedAd {
  placementKey: AdPlacementKey;
  adUnitId: string;
  code: string;
  format: string | null;
  showDesktop: boolean;
  showTablet: boolean;
  showMobile: boolean;
  reservedHeightDesktop: number;
  reservedHeightMobile: number;
}

type ArticleAdContext = {
  adsDisabled?: boolean;
  adOverrides?: Record<string, string | null> | null;
} | null;

function reservedFallback(key: AdPlacementKey) {
  const def = AD_PLACEMENTS.find((p) => p.key === key);
  return def?.reservedHeight ?? { desktop: 0, mobile: 0 };
}

export const adService = {
  /** Are ads globally on? (env kill switch — spec §16.) */
  isEnabled(): boolean {
    return ADSENSE.enabled && ADSENSE.publisherId.length > 0;
  },

  async resolve(
    placementKey: AdPlacementKey,
    article?: ArticleAdContext,
  ): Promise<ResolvedAd | null> {
    if (!this.isEnabled()) return null;
    if (article?.adsDisabled) return null;

    const override = article?.adOverrides?.[placementKey];
    if (override === null) return null; // explicitly disabled for this article

    let adUnitId = override ?? undefined;

    if (!adUnitId) {
      const placement = await prisma.adPlacement.findUnique({
        where: { placementKey },
      });
      if (!placement || !placement.enabled || !placement.adUnitId) return null;
      adUnitId = placement.adUnitId;
    }

    const unit = await prisma.adUnit.findUnique({ where: { id: adUnitId } });
    if (!unit || !unit.enabled) return null;

    const rf = reservedFallback(placementKey);
    return {
      placementKey,
      adUnitId: unit.id,
      code: unit.code,
      format: unit.format,
      showDesktop: unit.showDesktop,
      showTablet: unit.showTablet,
      showMobile: unit.showMobile,
      reservedHeightDesktop: unit.reservedHeightDesktop ?? rf.desktop,
      reservedHeightMobile: unit.reservedHeightMobile ?? rf.mobile,
    };
  },

  /** In-content auto-injection rule for an article type (spec §16, §46). */
  async getInContentRule(articleType: "STANDARD" | "LISTICLE") {
    const placement = await prisma.adPlacement.findUnique({
      where: { placementKey: "in-content" },
    });
    if (
      !placement ||
      !placement.enabled ||
      !placement.autoInject ||
      (placement.appliesTo && placement.appliesTo !== articleType)
    ) {
      return null;
    }
    return {
      everyNParagraphs: placement.everyNParagraphs ?? 4,
      maxInjections: placement.maxInjections ?? 3,
    };
  },
};
