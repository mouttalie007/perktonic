/**
 * Screenshots of our own tools for the articles: sets a tool up, captures a region, draws red arrows, circles, boxes and
 * numbers exactly on named elements, crops, converts to WebP, and (with --register) adds the images to the media library.
 *
 *   npx tsx --env-file=.env scripts/shots.mts <spec.json> [--base http://localhost:3001] [--out <dir>] [--register]
 *
 * A spec is { "shots": [ { id, tool | url, viewport?, mock?, steps?, capture?, annotate?, alt, caption, featured? } ] }.
 * See scripts/shots/README.md and scripts/shots/examples/. Needs the site running (best: the production build).
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { chromium, type Locator, type Page } from "playwright";
import sharp from "sharp";

// ---------------------------------------------------------------- types
type Loc = {
  role?: string;
  name?: string;
  label?: string;
  text?: string;
  placeholder?: string;
  css?: string;
  exact?: boolean;
  nth?: number;
  /** Search inside the tool area (.tool-stage) instead of the whole page. */
  in?: "stage";
  /** Use the nearest ancestor with this tag instead (e.g. "label", "section", "li"): the whole card, not the small element inside it. */
  closest?: string;
  /** Go up this many parents from the element found (use when `closest` is not enough). */
  up?: number;
};
type Step =
  | { fill: Loc & { value: string } }
  | { click: Loc }
  | { dblclick: Loc }
  | { select: Loc & { value: string } }
  | { check: Loc }
  | { uncheck: Loc }
  | { hover: Loc }
  | { clear: Loc }
  | { upload: Loc & { file: string } }
  | { press: string }
  | { waitText: string }
  | { waitGone: string }
  | { wait: number }
  | { scroll: Loc }
  /** Fills the first text box of the tool (the main input). */
  | { input: string }
  /** Fills the n-th text box of the tool (0 = first). */
  | { input2: { n: number; value: string } }
  /** Picks a radio option (by its text) in the tool. */
  | { radio: string }
  /** Presses a button of the tool, then waits for the "Example result" label to go (an AI answer arrived). */
  | { ai: string }
  /** Presses a button of the tool (no waiting). */
  | { press_button: string }
  /** Presses "Try an example". */
  | { example: true };
type Annotation =
  | { type: "arrow"; target: Loc; from?: "auto" | "top" | "bottom" | "left" | "right"; label?: string; length?: number }
  | { type: "circle"; target: Loc; pad?: number }
  | { type: "box"; target: Loc; pad?: number }
  | { type: "badge"; target: Loc; n: number }
  | { type: "text"; target: Loc; text: string; position?: "above" | "below" };
interface Shot {
  id: string;
  tool?: string;
  url?: string;
  viewport?: "desktop" | "mobile";
  mock?: { url: string; status?: number; json: unknown }[];
  steps?: Step[];
  /** What to capture: "stage" (the tool area, default), "page", "viewport", or one element. */
  capture?: "stage" | "page" | "viewport" | { of: Loc } | { section: string } | { fieldset: string } | { between: [Loc, Loc] };
  padding?: number;
  annotate?: Annotation[];
  alt: string;
  caption?: string;
  width?: number;
  featured?: boolean;
}
interface Spec {
  baseUrl?: string;
  shots: Shot[];
}
type Box = { x: number; y: number; w: number; h: number };

// ---------------------------------------------------------------- helpers
const RED = "#e11d48";
const VIEWPORTS = { desktop: { width: 1280, height: 900 }, mobile: { width: 390, height: 844 } };
const CSS = `
  nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important; }
  header.sticky { position: static !important; }
  .skip-link { display: none !important; }
  button[aria-label*="back to top" i], button[aria-label*="scroll to top" i] { display: none !important; }
  *, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; scroll-behavior: auto !important; }
`;

function locate(page: Page, l: Loc): Locator {
  const base = l.in === "stage" ? page.locator(".tool-stage") : page;
  let r: Locator;
  if (l.role) r = base.getByRole(l.role as never, { name: l.name, exact: l.exact });
  else if (l.label) r = base.getByLabel(l.label, { exact: l.exact });
  else if (l.text) r = base.getByText(l.text, { exact: l.exact });
  else if (l.placeholder) r = base.getByPlaceholder(l.placeholder, { exact: l.exact });
  else if (l.css) r = base.locator(l.css);
  else throw new Error("A locator needs role, label, text, placeholder or css: " + JSON.stringify(l));
  r = l.nth != null ? r.nth(l.nth) : r.first();
  if (l.closest) r = r.locator(`xpath=ancestor-or-self::${l.closest}[1]`);
  if (l.up) r = r.locator(`xpath=ancestor::*[${l.up}]`);
  return r;
}

async function boxOf(el: Locator): Promise<Box> {
  await el.scrollIntoViewIfNeeded();
  const b = await el.evaluate((n) => {
    const r = n.getBoundingClientRect();
    return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
  });
  if (!b.w || !b.h) throw new Error("The element has no size (is it visible?)");
  return b;
}

async function runStep(page: Page, s: Step) {
  if ("fill" in s) return locate(page, s.fill).fill(s.fill.value);
  if ("click" in s) return locate(page, s.click).click();
  if ("dblclick" in s) return locate(page, s.dblclick).dblclick();
  if ("select" in s) return locate(page, s.select).selectOption({ label: s.select.value });
  if ("check" in s) return locate(page, s.check).check();
  if ("uncheck" in s) return locate(page, s.uncheck).uncheck();
  if ("hover" in s) return locate(page, s.hover).hover();
  if ("clear" in s) return locate(page, s.clear).fill("");
  if ("upload" in s) {
    const l = s.upload.role || s.upload.label || s.upload.text || s.upload.css ? s.upload : { ...s.upload, css: "input[type=file]" };
    return locate(page, l).setInputFiles(path.resolve(s.upload.file));
  }
  if ("press" in s) return page.keyboard.press(s.press);
  if ("waitText" in s) return page.getByText(s.waitText).first().waitFor({ state: "visible", timeout: 90_000 });
  if ("waitGone" in s) return page.getByText(s.waitGone).first().waitFor({ state: "hidden", timeout: 90_000 });
  if ("wait" in s) return page.waitForTimeout(s.wait);
  if ("scroll" in s) return locate(page, s.scroll).scrollIntoViewIfNeeded();
  const stage = page.locator(".tool-stage");
  if ("input" in s) return stage.locator("textarea, input[type=text]").first().fill(s.input);
  if ("input2" in s) return stage.locator("textarea, input[type=text]").nth(s.input2.n).fill(s.input2.value);
  if ("radio" in s) return stage.getByRole("radio", { name: s.radio }).first().click();
  if ("press_button" in s) return stage.getByRole("button", { name: s.press_button, exact: true }).first().click();
  if ("example" in s) return stage.getByRole("button", { name: "Try an example", exact: true }).first().click();
  if ("ai" in s) {
    await stage.getByRole("button", { name: s.ai, exact: true }).first().click();
    await page.getByText("Example result (nothing was sent)").first().waitFor({ state: "hidden", timeout: 90_000 }).catch(() => {});
    await page.waitForTimeout(600);
    return;
  }
}

/** Where an arrow's tail goes, for a given side of the target. */
function tailFor(b: Box, side: "top" | "bottom" | "left" | "right", len: number) {
  const gap = 8;
  if (side === "left") return { tip: { x: b.x - gap, y: b.y + b.h / 2 }, tail: { x: b.x - gap - len, y: b.y + b.h / 2 - len * 0.4 } };
  if (side === "right") return { tip: { x: b.x + b.w + gap, y: b.y + b.h / 2 }, tail: { x: b.x + b.w + gap + len, y: b.y + b.h / 2 - len * 0.4 } };
  if (side === "top") return { tip: { x: b.x + b.w / 2, y: b.y - gap }, tail: { x: b.x + b.w / 2 - len * 0.4, y: b.y - gap - len } };
  return { tip: { x: b.x + b.w / 2, y: b.y + b.h + gap }, tail: { x: b.x + b.w / 2 - len * 0.4, y: b.y + b.h + gap + len } };
}

interface Drawn {
  svg: string;
  /** Extra area the drawing needs (so the crop includes every arrow and label). */
  extent: Box[];
}

function draw(boxes: { a: Annotation; b: Box }[], page: { w: number; h: number }): Drawn {
  const parts: string[] = [];
  const extent: Box[] = [];
  const stroke = (inner: string, width = 4) => `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#fff" stroke-width="${width + 4}" opacity="0.95">${inner}</g><g stroke="${RED}" stroke-width="${width}">${inner}</g></g>`;
  const pill = (x: number, y: number, text: string) => {
    const w = Math.max(28, text.length * 8.6 + 20);
    extent.push({ x, y: y - 14, w, h: 28 });
    return `<rect x="${x}" y="${y - 14}" width="${w}" height="28" rx="14" fill="${RED}"/><text x="${x + w / 2}" y="${y + 5}" font-family="Inter,Arial,sans-serif" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;
  };
  for (const { a, b } of boxes) {
    if (a.type === "circle") {
      const pad = a.pad ?? 10;
      const rx = Math.max(b.w / 2 + pad, 16);
      const ry = Math.max(b.h / 2 + pad * 0.8, 16);
      parts.push(stroke(`<ellipse cx="${b.x + b.w / 2}" cy="${b.y + b.h / 2}" rx="${rx}" ry="${ry}"/>`));
      extent.push({ x: b.x + b.w / 2 - rx - 4, y: b.y + b.h / 2 - ry - 4, w: rx * 2 + 8, h: ry * 2 + 8 });
    } else if (a.type === "box") {
      const pad = a.pad ?? 6;
      parts.push(stroke(`<rect x="${b.x - pad}" y="${b.y - pad}" width="${b.w + pad * 2}" height="${b.h + pad * 2}" rx="10"/>`));
      extent.push({ x: b.x - pad - 4, y: b.y - pad - 4, w: b.w + pad * 2 + 8, h: b.h + pad * 2 + 8 });
    } else if (a.type === "badge") {
      const cx = b.x - 4, cy = b.y - 4;
      parts.push(`<circle cx="${cx}" cy="${cy}" r="16" fill="${RED}" stroke="#fff" stroke-width="3"/><text x="${cx}" y="${cy + 6}" font-family="Inter,Arial,sans-serif" font-size="17" font-weight="800" fill="#fff" text-anchor="middle">${a.n}</text>`);
      extent.push({ x: cx - 20, y: cy - 20, w: 40, h: 40 });
    } else if (a.type === "text") {
      const y = a.position === "below" ? b.y + b.h + 26 : b.y - 18;
      parts.push(pill(b.x, y, a.text));
    } else if (a.type === "arrow") {
      const len = a.length ?? 80;
      const order = a.from && a.from !== "auto" ? [a.from] : (["bottom", "right", "left", "top"] as const);
      let pick = tailFor(b, order[0]!, len);
      for (const side of order) {
        const t = tailFor(b, side, len);
        if (t.tail.x > 30 && t.tail.y > 30 && t.tail.x < page.w - 30 && t.tail.y < page.h - 30) { pick = t; break; }
      }
      const { tip, tail } = pick;
      const ang = Math.atan2(tip.y - tail.y, tip.x - tail.x);
      const head = 20;
      const p1 = { x: tip.x - head * Math.cos(ang - 0.45), y: tip.y - head * Math.sin(ang - 0.45) };
      const p2 = { x: tip.x - head * Math.cos(ang + 0.45), y: tip.y - head * Math.sin(ang + 0.45) };
      parts.push(stroke(`<line x1="${tail.x}" y1="${tail.y}" x2="${tip.x - 4 * Math.cos(ang)}" y2="${tip.y - 4 * Math.sin(ang)}"/><polyline points="${p1.x},${p1.y} ${tip.x},${tip.y} ${p2.x},${p2.y}"/>`, 5));
      extent.push({ x: Math.min(tail.x, tip.x) - 6, y: Math.min(tail.y, tip.y) - 6, w: Math.abs(tail.x - tip.x) + 12, h: Math.abs(tail.y - tip.y) + 12 });
      if (a.label) parts.push(pill(tail.x - (tail.x < tip.x ? Math.max(28, a.label.length * 8.6 + 20) : 0) + (tail.x < tip.x ? 0 : 0), tail.y - (tail.y < tip.y ? 18 : -18), a.label));
    }
  }
  return { svg: parts.join(""), extent };
}

const union = (boxes: Box[]): Box => {
  const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

// ---------------------------------------------------------------- one shot
async function takeShot(browser: import("playwright").Browser, base: string, shot: Shot, outDir: string) {
  const vp = VIEWPORTS[shot.viewport ?? "desktop"];
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  for (const m of shot.mock ?? []) await page.route(m.url, (r) => r.fulfill({ status: m.status ?? 200, contentType: "application/json", body: JSON.stringify(m.json) }));
  const url = shot.url ?? `/tools/${shot.tool}`;
  await page.goto(url.startsWith("http") ? url : base + url, { waitUntil: "load", timeout: 120_000 });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Reject Non-Essential" }).click({ timeout: 1500 }).catch(() => {});
  await page.addStyleTag({ content: CSS });
  await page.evaluate(() => document.fonts.ready);
  for (const s of shot.steps ?? []) {
    await runStep(page, s);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(500);

  // what to capture
  const pad = shot.padding ?? 16;
  const docSize = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
  let region: Box;
  const cap = shot.capture ?? (shot.tool ? "stage" : "viewport");
  if (cap === "page") region = { x: 0, y: 0, w: docSize.w, h: docSize.h };
  else if (cap === "viewport") region = { x: 0, y: await page.evaluate(() => scrollY), w: vp.width, h: vp.height };
  else if (cap === "stage") region = await boxOf(page.locator(".tool-stage").first());
  else if ("between" in cap) region = union([await boxOf(locate(page, cap.between[0])), await boxOf(locate(page, cap.between[1]))]);
  // headings only: the same words also appear in buttons and in small print
  else if ("section" in cap) region = await boxOf(page.locator(".tool-stage").locator("h2, h3").filter({ hasText: cap.section }).first().locator("xpath=ancestor::*[self::section or self::fieldset][1]"));
  else if ("fieldset" in cap) region = await boxOf(page.locator(".tool-stage").locator("legend").filter({ hasText: cap.fieldset }).first().locator("xpath=ancestor::fieldset[1]"));
  else region = await boxOf(locate(page, cap.of));

  // annotations
  const placed: { a: Annotation; b: Box }[] = [];
  for (const a of shot.annotate ?? []) placed.push({ a, b: await boxOf(locate(page, a.target)) });
  const drawn = draw(placed, docSize);
  if (drawn.svg) {
    await page.evaluate(
      ({ svg, w, h }) => {
        const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        el.setAttribute("width", String(w));
        el.setAttribute("height", String(h));
        el.setAttribute("style", `position:absolute;left:0;top:0;pointer-events:none;z-index:2147483647`);
        el.innerHTML = svg;
        document.body.appendChild(el);
      },
      { svg: drawn.svg, w: docSize.w, h: docSize.h },
    );
  }
  const area = union([region, ...drawn.extent]);
  const clip = {
    x: Math.max(0, Math.floor(area.x - pad)),
    y: Math.max(0, Math.floor(area.y - pad)),
    width: 0,
    height: 0,
  };
  clip.width = Math.min(docSize.w - clip.x, Math.ceil(area.w + pad * 2));
  clip.height = Math.min(docSize.h - clip.y, Math.ceil(area.h + pad * 2));
  const png = await page.screenshot({ clip, fullPage: true, type: "png" });
  await ctx.close();

  const targetWidth = shot.width ?? (shot.viewport === "mobile" ? 780 : 1200);
  const file = path.join(outDir, `${shot.id}.webp`);
  const out = await sharp(png).resize({ width: targetWidth, withoutEnlargement: true }).webp({ quality: 88, effort: 5 }).toBuffer({ resolveWithObject: true });
  fs.writeFileSync(file, out.data);
  return { file, width: out.info.width, height: out.info.height, buffer: out.data };
}

// ---------------------------------------------------------------- media library
async function register(buffer: Buffer, shot: Shot, width: number, height: number) {
  const { prisma } = await import("@/lib/prisma");
  const dir = path.join(process.cwd(), "public", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  // Re-running a spec replaces the images of the same id instead of piling up copies in the library.
  for (const old of await prisma.media.findMany({ where: { title: shot.id } })) {
    const base = (old.storageKey ?? "").replace(/.webp$/, "");
    for (const f of [old.storageKey, old.ogUrl?.split("/").pop(), `${base}-640.webp`, `${base}-1080.webp`]) if (f) fs.rmSync(path.join(dir, f), { force: true });
    await prisma.media.delete({ where: { id: old.id } });
  }
  const key = `${randomUUID()}.webp`;
  fs.writeFileSync(path.join(dir, key), buffer);
  const base = key.slice(0, -5);
  for (const w of [640, 1080]) fs.writeFileSync(path.join(dir, `${base}-${w}.webp`), await sharp(buffer).resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer());
  const ogKey = `${randomUUID()}-og.webp`;
  fs.writeFileSync(path.join(dir, ogKey), await sharp(buffer).resize(1200, 630, { fit: "cover", position: "top" }).webp({ quality: 82 }).toBuffer());
  const media = await prisma.media.create({
    data: { url: `/uploads/${key}`, ogUrl: `/uploads/${ogKey}`, storageKey: key, provider: "local", filename: `${shot.id}.webp`, mimeType: "image/webp", fileSize: buffer.length, width, height, alt: shot.alt, caption: shot.caption ?? null, title: shot.id },
  });
  return media;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// ---------------------------------------------------------------- main
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const specPath = args.find((a) => !a.startsWith("--") && a !== opt("--base") && a !== opt("--out"));
if (!specPath) {
  console.error("Usage: npx tsx --env-file=.env scripts/shots.mts <spec.json> [--base URL] [--out DIR] [--register]");
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, "utf8")) as Spec;
const base = (opt("--base") ?? spec.baseUrl ?? "http://localhost:3001").replace(/\/$/, "");
const outDir = path.resolve(opt("--out") ?? path.join(path.dirname(specPath), "out"));
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const manifest: Record<string, unknown>[] = [];
let failed = 0;
for (const shot of spec.shots) {
  try {
    const r = await takeShot(browser, base, shot, outDir);
    const row: Record<string, unknown> = { id: shot.id, file: r.file, width: r.width, height: r.height, alt: shot.alt, caption: shot.caption ?? null, featured: !!shot.featured };
    if (flag("--register")) {
      const m = await register(r.buffer, shot, r.width, r.height);
      row.mediaId = m.id;
      row.url = m.url;
      row.ogUrl = m.ogUrl;
      row.html = `<figure><img src="${m.url}" alt="${esc(shot.alt)}" width="${r.width}" height="${r.height}" loading="lazy">${shot.caption ? `<figcaption>${esc(shot.caption)}</figcaption>` : ""}</figure>`;
    }
    manifest.push(row);
    console.log(`ok   ${shot.id}  ${r.width}x${r.height}  ${Math.round(r.buffer.length / 1024)} KB${row.url ? "  " + row.url : ""}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${shot.id}: ${e instanceof Error ? e.message.split("\n")[0] : e}`);
  }
}
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
await browser.close();
if (flag("--register")) (await import("@/lib/prisma")).prisma.$disconnect();
console.log(`${manifest.length}/${spec.shots.length} shot(s) in ${outDir}`);
process.exit(failed ? 1 : 0);
