/**
 * Accessibility audit (Phase 9) — runs axe-core against key routes and
 * fails on any "serious"/"critical" violation. "Moderate"/"minor" are
 * printed for awareness but don't fail the run.
 *
 *   node scripts/a11y-audit.mjs [baseURL] [route ...]
 *
 * Defaults to the public-site routes that matter most for WCAG 2.2 AA
 * (anonymous visitors), plus the admin login page (also public). Full
 * dashboard screens are internal-staff-only and audited separately on
 * request, not as part of this default sweep.
 */
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const routeArgs = process.argv.slice(3).filter((r) => r.startsWith("/"));
const routes =
  routeArgs.length > 0
    ? routeArgs
    : [
        "/",
        "/about",
        "/contact",
        "/unsubscribe",
        "/category/tech",
        "/search",
        "/admin/login",
      ];

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const browser = await chromium.launch();
let failures = 0;
const allResults = [];

for (const route of routes) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  // Give the consent banner a moment to mount so it's included in the scan.
  await page.waitForTimeout(300);

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  allResults.push({ route, results });

  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  const other = results.violations.filter(
    (v) => v.impact !== "serious" && v.impact !== "critical",
  );

  if (serious.length > 0) {
    failures += serious.length;
    console.log(`FAIL ${route} — ${serious.length} serious/critical violation(s):`);
    for (const v of serious) {
      console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s)) — ${v.helpUrl}`);
      for (const n of v.nodes.slice(0, 3)) {
        console.log(`      ${n.target.join(" ")}`);
      }
    }
  } else {
    console.log(`OK   ${route} — 0 serious/critical violations`);
  }

  if (other.length > 0) {
    console.log(`     (${other.length} lower-impact: ${other.map((v) => `${v.id}[${v.impact}]`).join(", ")})`);
  }

  await context.close();
}

await browser.close();

console.log("");
if (failures > 0) {
  console.log(`AUDIT FAILED — ${failures} serious/critical violation(s) across ${routes.length} route(s)`);
  process.exit(1);
} else {
  console.log(`AUDIT CLEAN — 0 serious/critical violations across ${routes.length} route(s)`);
}
