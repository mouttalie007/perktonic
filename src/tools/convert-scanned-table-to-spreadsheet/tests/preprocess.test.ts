import { describe, expect, test } from "vitest";
import { adaptiveThreshold, contrastStretch, findSkew, grayscale, prepare, rotate, upscale, upscaleFactor, type Gray } from "../src/logic/preprocess";
import { findRuleLines } from "../src/logic/rules";

/** White page with dark horizontal text-like bars, rotated by `deg` degrees. */
function page(deg: number, w = 400, h = 300): Gray {
  const data = new Uint8Array(w * h).fill(235);
  const t = (deg * Math.PI) / 180;
  for (let line = 0; line < 8; line++) {
    const y0 = 40 + line * 30;
    for (let x = 40; x < 360; x++) {
      if (x % 23 > 18) continue; // gaps between "words"
      for (let k = 0; k < 6; k++) {
        const y = y0 + k;
        const xr = Math.round((x - w / 2) * Math.cos(t) - (y - h / 2) * Math.sin(t) + w / 2);
        const yr = Math.round((x - w / 2) * Math.sin(t) + (y - h / 2) * Math.cos(t) + h / 2);
        if (xr >= 0 && yr >= 0 && xr < w && yr < h) data[yr * w + xr] = 40;
      }
    }
  }
  return { width: w, height: h, data };
}

const rgba = (g: Gray) => {
  const d = new Uint8ClampedArray(g.width * g.height * 4);
  g.data.forEach((v, i) => d.set([v, v, v, 255], i * 4));
  return { width: g.width, height: g.height, data: d };
};

describe("image clean-up", () => {
  test("grayscale uses luminance; transparent pixels are paper", () => {
    const g = grayscale({ width: 3, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255, 10, 10, 10, 0]) });
    expect([...g.data]).toEqual([76, 29, 255]);
  });

  test("contrast stretch turns a grey, washed-out scan into black on white", () => {
    const g = { width: 100, height: 1, data: Uint8Array.from({ length: 100 }, (_, i) => (i < 20 ? 110 : 170)) };
    const s = contrastStretch(g);
    expect(Math.min(...s.data)).toBe(0);
    expect(Math.max(...s.data)).toBe(255);
  });

  test("the adaptive threshold keeps text readable under a shadow that a global threshold would blacken", () => {
    const w = 200;
    const h = 40;
    // Paper goes from 230 (left) to 90 (right, in shadow); text is 60 darker than the paper around it.
    const data = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = Math.round(230 - (140 * x) / w) - (y >= 18 && y < 22 && x % 10 < 5 ? 60 : 0);
    const t = adaptiveThreshold({ width: w, height: h, data });
    const blackInShadow = [...Array(40).keys()].filter((x) => t.data[5 * w + 150 + x] === 0).length;
    expect(blackInShadow).toBe(0);
    expect(t.data[20 * w + 150]).toBe(0);
    expect(t.data[20 * w + 10]).toBe(0);
  });

  test("deskew: a page tilted by 3° is measured and straightened", () => {
    const tilted = page(3);
    const skew = findSkew(tilted);
    expect(Math.abs(Math.abs(skew) - 3)).toBeLessThanOrEqual(0.3);
    expect(Math.abs(findSkew(rotate(tilted, skew)))).toBeLessThanOrEqual(0.3);
    expect(findSkew(page(0))).toBe(0);
    expect(Math.abs(Math.abs(findSkew(page(-4.5))) - 4.5)).toBeLessThanOrEqual(0.3);
  });

  test("small images are upscaled; the whole clean-up reports the skew and the scale", () => {
    expect(upscaleFactor(400)).toBe(3);
    expect(upscaleFactor(1200)).toBe(1);
    const u = upscale({ width: 2, height: 1, data: Uint8Array.from([0, 255]) }, 2);
    expect(u.width).toBe(4);
    expect(u.data[0]).toBe(0);
    expect(u.data[3]).toBe(255);
    const out = prepare(rgba(page(2)), { contrast: true, deskew: true, threshold: true });
    expect(Math.abs(out.skew - 2) <= 0.3 || Math.abs(out.skew + 2) <= 0.3).toBe(true);
    expect(out.scale).toBe(3);
    expect(out.image.width).toBe(1200);
    expect(new Set(out.image.data).size).toBeLessThanOrEqual(256);
  });

  test("ruled lines are found by projecting dark pixels", () => {
    const w = 300;
    const h = 200;
    const data = new Uint8Array(w * h).fill(250);
    for (const y of [20, 60, 100, 140]) for (let x = 10; x < 290; x++) data[y * w + x] = 20;
    for (const x of [10, 150, 289]) for (let y = 20; y <= 140; y++) data[y * w + x] = 20;
    const r = findRuleLines({ width: w, height: h, data });
    expect(r.h).toEqual([20, 60, 100, 140]);
    expect(r.v).toEqual([10, 150, 289]);
  });
});
