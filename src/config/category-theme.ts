import type { CategoryKey } from "./site";

/**
 * Colour of each tool category: the same hue as the covers of its articles, so the
 * tools hub, the blog and the covers read as one system. `tint` is a very light
 * background, `deep` a text-safe dark shade.
 */
export interface CategoryTheme {
  base: string;
  tint: string;
  deep: string;
}

export const CATEGORY_THEME: Record<CategoryKey, CategoryTheme> = {
  "spreadsheet-studio": { base: "#E0A800", tint: "#FFF8E1", deep: "#7A5A00" },
  "data-converters": { base: "#7C3AED", tint: "#F3EEFF", deep: "#5B21B6" },
  "document-intelligence": { base: "#DC2626", tint: "#FEF0F0", deep: "#991B1B" },
  "workflow-automation": { base: "#D9640B", tint: "#FFF2E8", deep: "#9A3F00" },
  "web-diagnostics": { base: "#2563EB", tint: "#EDF3FF", deep: "#1E40AF" },
};
