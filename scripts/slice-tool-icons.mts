/**
 * Slice one 3D icon sheet into one WebP per tool.
 *
 *   npx tsx scripts/slice-tool-icons.mts <sheet.png> [--categories] [--bg white|alpha] [--mode auto|grid]
 *
 * The sheet has one row per category (in CATEGORIES order) and one icon per tool (in TOOLS
 * order). Icons are found from the empty space between them (--mode grid forces a fixed grid). The background is removed
 * (flood fill from the cell border), the icon is trimmed, centred on a square canvas and
 * saved to public/brand/tool-icons/<slug>.webp. Then src/config/tool-icons.ts is rewritten
 * with the slugs that now have an icon. With --categories the sheet is one row of 5 category
 * icons (CATEGORIES order) saved to public/brand/category-icons/ and listed in CATEGORY_ICON_SLUGS.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { CATEGORIES } from "../src/config/site";
import { TOOLS } from "../src/config/tools";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const opt = (name: string, d: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : d;
};
if (!file) {
  console.error("usage: slice-tool-icons.mts <sheet.png> [--categories] [--cols N] [--rows N] [--bg white|alpha] [--mode auto|grid]");
  process.exit(1);
}

const CATEGORY_MODE = args.includes("--categories");
const OUT = path.resolve(CATEGORY_MODE ? "public/brand/category-icons" : "public/brand/tool-icons");
const SET_NAME = CATEGORY_MODE ? "CATEGORY_ICON_SLUGS" : "TOOL_ICON_SLUGS";
const SIZE = 256;
const rows: Array<Array<{ slug: string }>> = CATEGORY_MODE
  ? [CATEGORIES.map((c) => ({ slug: c.slug }))]
  : CATEGORIES.map((c) => TOOLS.filter((t) => t.categorySlug === c.slug));
const cols = Number(opt("cols", String(Math.max(...rows.map((r) => r.length)))));
const nRows = Number(opt("rows", String(rows.length)));
const bgMode = opt("bg", "white");
const TOL = Number(opt("tol", "14"));

/** Make pixels connected to the border and close to the background colour transparent. */
function cutBackground(buf: Buffer, w: number, h: number): Buffer {
  const out = Buffer.from(buf);
  const corner = [0, 4 * (w - 1), 4 * w * (h - 1), 4 * (w * h - 1)].map((o) => [out[o], out[o + 1], out[o + 2]]);
  const bg = corner[0];
  const near = (i: number) => {
    const d = Math.abs(out[i] - bg[0]) + Math.abs(out[i + 1] - bg[1]) + Math.abs(out[i + 2] - bg[2]);
    return d < TOL;
  };
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * w + x;
    if (x < 0 || y < 0 || x >= w || y >= h || seen[p]) return;
    if (!near(p * 4)) return;
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop()!;
    out[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p / w) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  // soften the 1px fringe left next to removed pixels
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (out[p * 4 + 3] === 0) continue;
      if (out[(p - 1) * 4 + 3] === 0 || out[(p + 1) * 4 + 3] === 0 || out[(p - w) * 4 + 3] === 0 || out[(p + w) * 4 + 3] === 0) {
        const d = Math.abs(out[p * 4] - bg[0]) + Math.abs(out[p * 4 + 1] - bg[1]) + Math.abs(out[p * 4 + 2] - bg[2]);
        if (d < 60) out[p * 4 + 3] = 120;
      }
    }
  }
  return out;
}

const meta = await sharp(file).metadata();
const W = meta.width!;
const H = meta.height!;
const full = await sharp(file).ensureAlpha().raw().toBuffer();
fs.mkdirSync(OUT, { recursive: true });

/** Runs of indices where `on` is true, merging gaps shorter than `gap`. */
function runs(on: boolean[], gap: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let start = -1;
  let last = -1;
  for (let i = 0; i < on.length; i++) {
    if (!on[i]) continue;
    if (start < 0) start = i;
    else if (i - last > gap) {
      out.push([start, last]);
      start = i;
    }
    last = i;
  }
  if (start >= 0) out.push([start, last]);
  return out;
}

const bgPx = [full[0], full[1], full[2]];
const ink = (x: number, y: number) => {
  const o = (y * W + x) * 4;
  return Math.abs(full[o] - bgPx[0]) + Math.abs(full[o + 1] - bgPx[1]) + Math.abs(full[o + 2] - bgPx[2]) > 40;
};

/** Cell boxes per category row: detected from the empty space between icons, or a fixed grid. */
const boxes: Array<Array<{ left: number; top: number; width: number; height: number }>> = [];
if (opt("mode", "auto") === "grid") {
  const cw = Math.floor(W / cols);
  const ch = Math.floor(H / nRows);
  rows.forEach((r, i) => boxes.push(r.map((_, c) => ({ left: c * cw, top: i * ch, width: cw, height: ch }))));
} else {
  const rowInk = Array.from({ length: H }, (_, y) => {
    for (let x = 0; x < W; x++) if (ink(x, y)) return true;
    return false;
  });
  const bands = runs(rowInk, 8);
  if (bands.length !== rows.length) throw new Error(`found ${bands.length} rows of icons, expected ${rows.length}; try --mode grid`);
  bands.forEach(([y0, y1], i) => {
    const colInk = Array.from({ length: W }, (_, x) => {
      for (let y = y0; y <= y1; y++) if (ink(x, y)) return true;
      return false;
    });
    const segs = runs(colInk, 10);
    if (segs.length !== rows[i].length) {
      throw new Error(`row ${i + 1}: found ${segs.length} icons, expected ${rows[i].length}; try --mode grid`);
    }
    boxes.push(segs.map(([x0, x1]) => ({ left: Math.max(0, x0 - 6), top: Math.max(0, y0 - 6), width: Math.min(W, x1 + 7) - Math.max(0, x0 - 6), height: Math.min(H, y1 + 7) - Math.max(0, y0 - 6) })));
  });
}

const done: string[] = [];
for (let r = 0; r < rows.length; r++) {
  for (let c = 0; c < rows[r].length; c++) {
    const tool = rows[r][c];
    const cell = await sharp(file).extract(boxes[r][c]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { data, info } = cell;
    const rgba = bgMode === "alpha" ? data : cutBackground(data, info.width, info.height);
    const icon = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
      .trim({ threshold: 1 })
      .resize(SIZE - 16, SIZE - 16, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 92, alphaQuality: 100 })
      .toBuffer();
    fs.writeFileSync(path.join(OUT, `${tool.slug}.webp`), icon);
    done.push(tool.slug);
  }
}

const list = done.map((s) => `  "${s}",`).join("\n");
const cfg = path.resolve("src/config/tool-icons.ts");
const src = fs.readFileSync(cfg, "utf8");
const open = "new Set<string>([";
const from = src.indexOf(open, src.indexOf(`export const ${SET_NAME}`));
const to = src.indexOf("]);", from);
if (from < 0 || to < 0) throw new Error(`${SET_NAME} not found in ${cfg}`);
fs.writeFileSync(cfg, `${src.slice(0, from + open.length)}\n${list}\n${src.slice(to)}`);
console.log(`Sliced ${done.length} icons from a ${W}x${H} sheet into ${path.relative(process.cwd(), OUT)}.`);
