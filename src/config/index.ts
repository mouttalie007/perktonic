// Client-safe barrel. Server-only env lives in "@/config/env.server".
export { clientEnv } from "./env";
export {
  SITE,
  SOCIAL_LINKS,
  CATEGORIES,
  NAV_PRIMARY,
  NAV_MORE,
  QUICK_NAV_CATEGORIES,
  LEGAL_PAGES,
  DEFAULT_AUTHOR_NAME,
} from "./site";
export type { CategoryKey, CategoryDef } from "./site";
export {
  ADSENSE,
  AD_PLACEMENTS,
  AD_PLACEMENT_KEYS,
  AD_LABEL,
} from "./ads";
export type { AdPlacementKey, AdPlacementDef } from "./ads";
export { ANALYTICS } from "./analytics";
