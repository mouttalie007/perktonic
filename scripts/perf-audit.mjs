/**
 * Performance / Core Web Vitals audit (Phase 9) — runs Lighthouse against a
 * running `next start` (production) server. `next dev` numbers are not
 * representative (no minification, no RSC caching) — always point this at
 * a production build.
 *
 *   npm run build && npm run start &
 *   node scripts/perf-audit.mjs [baseURL] [route ...]
 *
 * Thresholds follow the spec: LCP < 2.5s, CLS < 0.1, TBT < 200ms (INP has
 * no lab-mode equivalent in Lighthouse; TBT is its standard proxy).
 * Reports -> scripts/.audit/lighthouse-<route>.json (full trace) + a
 * console summary. Exits non-zero if any route misses a threshold.
 */
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const routeArgs = process.argv.slice(3).filter((r) => r.startsWith("/"));
const routes = routeArgs.length > 0 ? routeArgs : ["/", "/about", "/category/tech", "/contact"];

const THRESHOLDS = { lcp: 2500, cls: 0.1, tbt: 200 };
const outDir = path.join(import.meta.dirname, ".audit");
await mkdir(outDir, { recursive: true });

const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new"] });
let failures = 0;

for (const route of routes) {
  const url = `${base}${route}`;
  const result = await lighthouse(url, {
    port: chrome.port,
    output: "json",
    logLevel: "error",
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    formFactor: "mobile",
    screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 2.625, disabled: false },
    throttlingMethod: "simulate",
  });

  const lhr = result.lhr;
  const fileSafe = route === "/" ? "home" : route.replace(/\//g, "_");
  await writeFile(path.join(outDir, `lighthouse-${fileSafe}.json`), result.report);

  const lcp = lhr.audits["largest-contentful-paint"].numericValue;
  const cls = lhr.audits["cumulative-layout-shift"].numericValue;
  const tbt = lhr.audits["total-blocking-time"].numericValue;
  const scores = {
    performance: Math.round(lhr.categories.performance.score * 100),
    accessibility: Math.round(lhr.categories.accessibility.score * 100),
    bestPractices: Math.round(lhr.categories["best-practices"].score * 100),
    seo: Math.round(lhr.categories.seo.score * 100),
  };

  const lcpOk = lcp <= THRESHOLDS.lcp;
  const clsOk = cls <= THRESHOLDS.cls;
  const tbtOk = tbt <= THRESHOLDS.tbt;
  const ok = lcpOk && clsOk && tbtOk;
  if (!ok) failures++;

  console.log(`${ok ? "OK  " : "FAIL"} ${route}`);
  console.log(
    `     LCP=${(lcp / 1000).toFixed(2)}s${lcpOk ? "" : " ⚠"}  CLS=${cls.toFixed(3)}${clsOk ? "" : " ⚠"}  TBT=${tbt.toFixed(0)}ms${tbtOk ? "" : " ⚠"}`,
  );
  console.log(
    `     Lighthouse: Perf=${scores.performance} A11y=${scores.accessibility} BestPractices=${scores.bestPractices} SEO=${scores.seo}`,
  );
}

await chrome.kill();

console.log("");
if (failures > 0) {
  console.log(`AUDIT FAILED — ${failures}/${routes.length} route(s) missed a Core Web Vitals threshold`);
  process.exit(1);
} else {
  console.log(`AUDIT CLEAN — all ${routes.length} route(s) within LCP<2.5s / CLS<0.1 / TBT<200ms`);
}
