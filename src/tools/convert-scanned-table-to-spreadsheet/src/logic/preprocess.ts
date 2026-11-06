// Image clean-up before OCR, as pure functions on pixel arrays (run in a Web Worker by the page).
import type { ImageLike } from "../ocr/types";

/** One byte per pixel, 0 = black, 255 = white. */
export interface Gray {
  width: number;
  height: number;
  data: Uint8Array;
}

export function grayscale(img: ImageLike): Gray {
  const n = img.width * img.height;
  const data = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = img.data[i * 4 + 3] / 255;
    const lum = 0.299 * img.data[i * 4] + 0.587 * img.data[i * 4 + 1] + 0.114 * img.data[i * 4 + 2];
    // Transparent pixels count as white paper.
    data[i] = Math.round(lum * a + 255 * (1 - a));
  }
  return { width: img.width, height: img.height, data };
}

/** Stretches the 1st-99th percentile range to 0-255 (low contrast and grey paper). */
export function contrastStretch(g: Gray, lowPct = 0.1, highPct = 99): Gray {
  const hist = new Uint32Array(256);
  for (const v of g.data) hist[v]++;
  const n = g.data.length;
  const at = (pct: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= (n * pct) / 100) return v;
    }
    return 255;
  };
  const lo = at(lowPct);
  const hi = at(highPct);
  // A narrow range is paper tint and noise (a page that is mostly background): stretching it would turn the noise into specks.
  if (hi - lo < 40) return { ...g, data: g.data.slice() };
  const data = new Uint8Array(n);
  for (let i = 0; i < n; i++) data[i] = Math.max(0, Math.min(255, Math.round(((g.data[i] - lo) * 255) / (hi - lo))));
  return { width: g.width, height: g.height, data };
}

/**
 * Adaptive threshold (mean of a square window, from an integral image): handles shadows and uneven
 * light, where one global threshold would turn half the page black.
 */
export function adaptiveThreshold(g: Gray, window = 25, offset = 12): Gray {
  const { width: w, height: h } = g;
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += g.data[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const r = Math.floor(window / 2);
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const sum = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      data[y * w + x] = g.data[y * w + x] < mean - offset ? 0 : 255;
    }
  }
  return { width: w, height: h, data };
}

/** Dark pixels (sampled when there are many) for the skew search. */
function darkPoints(g: Gray, limit = 60000): [number, number][] {
  const pts: [number, number][] = [];
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) if (g.data[y * g.width + x] < 128) pts.push([x, y]);
  if (pts.length <= limit) return pts;
  const step = pts.length / limit;
  return Array.from({ length: limit }, (_, i) => pts[Math.floor(i * step)]);
}

function projectionVariance(pts: [number, number][], angleDeg: number, height: number): number {
  const t = (angleDeg * Math.PI) / 180;
  const sin = Math.sin(t);
  const cos = Math.cos(t);
  const off = height;
  const bins = new Float64Array(height * 3);
  for (const [x, y] of pts) {
    const b = Math.round(y * cos - x * sin + off);
    if (b >= 0 && b < bins.length) bins[b]++;
  }
  let sum = 0;
  let sq = 0;
  for (const v of bins) {
    sum += v;
    sq += v * v;
  }
  const n = bins.length;
  return sq / n - (sum / n) ** 2;
}

/**
 * The skew angle in degrees (within ±maxDeg): the rotation that makes the row projection of dark
 * pixels most peaked (text lines and rules line up with pixel rows). Positive = the content is
 * rotated counter-clockwise and must be turned clockwise by that much.
 */
export function findSkew(g: Gray, maxDeg = 5): number {
  const pts = darkPoints(g);
  if (pts.length < 50) return 0;
  let best = 0;
  let bestV = -1;
  for (let a = -maxDeg; a <= maxDeg + 1e-9; a += 0.5) {
    const v = projectionVariance(pts, a, g.height);
    if (v > bestV) {
      bestV = v;
      best = a;
    }
  }
  const coarse = best;
  for (let a = coarse - 0.5; a <= coarse + 0.5 + 1e-9; a += 0.1) {
    const v = projectionVariance(pts, a, g.height);
    if (v > bestV) {
      bestV = v;
      best = a;
    }
  }
  return Math.round(best * 10) / 10;
}

/** Rotates around the centre (bilinear), filling the corners with white. */
export function rotate(g: Gray, angleDeg: number): Gray {
  if (Math.abs(angleDeg) < 0.05) return { ...g, data: g.data.slice() };
  const t = (angleDeg * Math.PI) / 180;
  const sin = Math.sin(t);
  const cos = Math.cos(t);
  const { width: w, height: h } = g;
  const cx = w / 2;
  const cy = h / 2;
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // Source pixel of destination (x, y): inverse rotation.
      const sx = cos * (x - cx) - sin * (y - cy) + cx;
      const sy = sin * (x - cx) + cos * (y - cy) + cy;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) {
        data[y * w + x] = 255;
        continue;
      }
      const fx = sx - x0;
      const fy = sy - y0;
      const p = (xx: number, yy: number) => g.data[yy * w + xx];
      data[y * w + x] = Math.round(p(x0, y0) * (1 - fx) * (1 - fy) + p(x0 + 1, y0) * fx * (1 - fy) + p(x0, y0 + 1) * (1 - fx) * fy + p(x0 + 1, y0 + 1) * fx * fy);
    }
  return { width: w, height: h, data };
}

/** Small images are upscaled (OCR engines read text best at about 30 px per line). */
export function upscale(g: Gray, factor: number): Gray {
  if (factor <= 1) return g;
  const w = Math.round(g.width * factor);
  const h = Math.round(g.height * factor);
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(g.height - 1, (y + 0.5) / factor - 0.5);
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(g.height - 1, y0 + 1);
    const fy = Math.max(0, sy - y0);
    for (let x = 0; x < w; x++) {
      const sx = Math.min(g.width - 1, (x + 0.5) / factor - 0.5);
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(g.width - 1, x0 + 1);
      const fx = Math.max(0, sx - x0);
      const p = (xx: number, yy: number) => g.data[yy * g.width + xx];
      data[y * w + x] = Math.round(p(x0, y0) * (1 - fx) * (1 - fy) + p(x1, y0) * fx * (1 - fy) + p(x0, y1) * (1 - fx) * fy + p(x1, y1) * fx * fy);
    }
  }
  return { width: w, height: h, data };
}

export const upscaleFactor = (width: number) => (width < 800 ? Math.min(3, Math.ceil(1600 / width)) : 1);

export function toImageData(g: Gray): ImageLike {
  const data = new Uint8ClampedArray(g.width * g.height * 4);
  for (let i = 0; i < g.data.length; i++) {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = g.data[i];
    data[i * 4 + 3] = 255;
  }
  return { width: g.width, height: g.height, data };
}

export interface PrepareOptions {
  contrast: boolean;
  threshold: boolean;
  deskew: boolean;
}

/** The whole clean-up: grayscale, contrast, deskew, optional threshold, upscale of small images. */
export function prepare(img: ImageLike, o: PrepareOptions): { image: Gray; skew: number; scale: number } {
  let g = grayscale(img);
  if (o.contrast) g = contrastStretch(g);
  let skew = 0;
  if (o.deskew) {
    skew = findSkew(g);
    if (skew) g = rotate(g, skew);
  }
  if (o.threshold) g = adaptiveThreshold(g);
  const scale = upscaleFactor(g.width);
  return { image: upscale(g, scale), skew, scale };
}
