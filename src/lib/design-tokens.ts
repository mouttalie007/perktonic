/**
 * TypeScript mirror of the design tokens defined in src/app/globals.css.
 * Use this only where CSS custom properties can't reach — e.g. values passed
 * to structured data, canvas, chart libraries, or inline SVG.
 * globals.css remains the source of truth for anything rendered as CSS.
 */

export const colors = {
  canvas: "#ffffff",
  surface: "#f7f7f7",
  ink: "#111111",
  inkDeep: "#0a0a0a",
  brand: "#ffd400",
  brandStrong: "#ffc400",
  accentRed: "#ff304f",
  accentBlue: "#1683ff",
  line: "#e5e5e5",
  muted: "#707070",
} as const;

export const layout = {
  pageWidth: 1320,
  articleWidth: 812,
} as const;

export const radius = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
} as const;

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export const zIndex = {
  header: 100,
  dropdown: 200,
  overlay: 300,
  modal: 400,
  toast: 500,
} as const;

export const motion = {
  easeOut: "cubic-bezier(0.22, 1, 0.36, 1)",
  durationFast: 120,
  durationBase: 200,
} as const;

export const designTokens = {
  colors,
  layout,
  radius,
  breakpoints,
  zIndex,
  motion,
} as const;
