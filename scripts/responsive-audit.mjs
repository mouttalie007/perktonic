/**
 * Responsive audit — loads routes at several widths, flags horizontal
 * overflow, records console/page errors, writes full-page screenshots.
 *
 *   node scripts/responsive-audit.mjs [baseURL] [route ...]
 *
 * Defaults: http://localhost:3000  with routes  /  /about  /nonexistent-xyz
 * Screenshots -> scripts/.audit/
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const routeArgs = process.argv.slice(3).filter((r) => r.startsWith("/"));
const routes = routeArgs.length > 0 ? routeArgs : ["/", "/about", "/nonexistent-xyz"];

const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440];
const outDir = path.join(import.meta.dirname, ".audit");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
let failures = 0;

for (const route of routes) {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    let status = 0;
    try {
      const res = await page.goto(base + route, { waitUntil: "networkidle" });
      status = res?.status() ?? 0;
    } catch (e) {
      errors.push("goto failed: " + String(e));
    }
    await page.waitForTimeout(150);

    const metrics = await page.evaluate(() => {
      const de = document.documentElement;
      let widest = null;
      let max = de.clientWidth;
      for (const el of document.body.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.right > max + 1) {
          max = Math.round(r.right);
          widest =
            el.tagName.toLowerCase() +
            (el.className ? "." + String(el.className).slice(0, 70) : "");
        }
      }
      return {
        scrollWidth: de.scrollWidth,
        clientWidth: de.clientWidth,
        widest,
        widestRight: max,
      };
    });

    const overflow = metrics.scrollWidth > metrics.clientWidth + 1;
    // A 404 route legitimately returns 404 and logs a "failed to load resource"
    // console line — don't count that as a failure.
    const realErrors = errors.filter(
      (e) => !/status of 404/.test(e) || status < 400,
    );
    const bad = overflow || realErrors.length > 0 || status >= 500;
    if (bad) failures++;

    const tag = (route === "/" ? "home" : route.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "")) + "_" + width;
    await page.screenshot({ path: path.join(outDir, tag + ".png"), fullPage: true });

    console.log(
      `${bad ? "x" : "OK"}  ${route.padEnd(16)} @${String(width).padEnd(4)} status=${status}` +
        (overflow
          ? `  OVERFLOW scrollW=${metrics.scrollWidth} clientW=${metrics.clientWidth} widest=[${metrics.widest}] right=${metrics.widestRight}`
          : "") +
        (realErrors.length ? `  ERR: ${realErrors.slice(0, 2).join(" | ").slice(0, 200)}` : ""),
    );
    await page.close();
  }
}

await browser.close();
console.log(failures === 0 ? "\nALL CLEAN" : `\n${failures} problem viewport(s) — see scripts/.audit/`);
process.exit(failures === 0 ? 0 : 1);
