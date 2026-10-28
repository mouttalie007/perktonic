/* eslint-disable no-console */
/**
 * Adds the five "cloud tools" categories (2026-10-28 plan, gemini-code-1793222689433.md)
 * to the database. Idempotent: matches on slug, never touches the old categories or
 * their articles. They are NOT in the header/footer menu yet on purpose: a category
 * page with no articles is an empty page, so they are also left out of the sitemap
 * (and set to noindex) until each has its first published article.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  {
    slug: "spreadsheet-studio",
    name: "Spreadsheet & Formula Studio",
    iconKey: "cpu",
    accentColor: "#047857",
    shortDescription: "Excel & Sheets formulas, explained",
    description:
      "Stop wrestling with broken syntax and #VALUE! errors. Use PerkTonic’s cloud-powered Spreadsheet Studio to translate plain English into production-ready Excel and Google Sheets formulas, explain nested logic step-by-step, and automate complex data lookups.",
    seoTitle:
      "Spreadsheet & Formula Studio | Excel & Google Sheets AI Tools - PerkTonic",
    metaDescription:
      "Generate, debug, and explain complex Excel and Google Sheets formulas instantly with PerkTonic. Build dynamic XLOOKUP, QUERY, ARRAYFORMULA, and VBA/Apps Script automations online.",
  },
  {
    slug: "data-converters",
    name: "Data Cleaning & File Converters",
    iconKey: "atom",
    accentColor: "#1D4ED8",
    shortDescription: "CSV, JSON, Markdown & LaTeX",
    description:
      "Transform raw, unformatted data into clean, structured assets in seconds. PerkTonic’s server-side conversion engine sanitizes messy CSV exports, removes duplicate records, normalizes dates, and converts seamlessly between JSON, Excel, Markdown, and LaTeX.",
    seoTitle:
      "Data Cleaning & Cloud File Converters | CSV, JSON, Markdown & LaTeX - PerkTonic",
    metaDescription:
      "Clean messy datasets and convert files seamlessly in the cloud with PerkTonic. Transform CSV, JSON, Excel, Markdown tables, HTML, and LaTeX documents with zero formatting loss.",
  },
  {
    slug: "document-intelligence",
    name: "Document & Text Intelligence",
    iconKey: "sparkles",
    accentColor: "#6D28D9",
    shortDescription: "PDF tables, summaries & templates",
    description:
      "Unlock trapped data inside static files and lengthy documents. PerkTonic’s Document Intelligence tools extract financial and technical tables from PDFs directly into Excel, distill complex agreements into actionable checklists, and generate standardized business documentation.",
    seoTitle:
      "Document & Text Intelligence | PDF Table Extractor & AI Summarizer - PerkTonic",
    metaDescription:
      "Extract tables from PDFs to Excel, parse structured data from documents, and generate professional B2B templates and SOPs with PerkTonic’s Document Intelligence suite.",
  },
  {
    slug: "workflow-automation",
    name: "Workflow & Automation Utilities",
    iconKey: "flame",
    accentColor: "#92400E",
    shortDescription: "Regex, cron, webhooks & diagrams",
    description:
      "Precision utilities built for operations teams, developers, and no-code automation architects. Build bulletproof Regex patterns, schedule Cron expressions with human-readable translations, inspect JSON webhook payloads, and convert text into visual flowcharts.",
    seoTitle:
      "Workflow & Automation Utilities | Regex, Cron, Webhooks & Diagrams - PerkTonic",
    metaDescription:
      "Supercharge your technical workflows with PerkTonic. Build and test Regular Expressions (Regex), generate Cron job schedules, format Webhook JSON payloads, and render Mermaid.js diagrams.",
  },
  {
    slug: "web-diagnostics",
    name: "Web & Network Diagnostics",
    iconKey: "globe",
    accentColor: "#0E7490",
    shortDescription: "Redirects, headers & meta audits",
    description:
      "Deep server-side inspection tools for webmasters, technical SEOs, and system administrators. Trace multi-hop 301/302 redirect chains, audit HTTP security headers, measure global Time to First Byte (TTFB), and verify structured metadata in real time.",
    seoTitle:
      "Web & Network Diagnostics | Redirect Checker, HTTP Headers & Meta Audit - PerkTonic",
    metaDescription:
      "Analyze website performance and server configurations with PerkTonic’s cloud diagnostics. Trace 301/302 redirect chains, inspect HTTP response headers, measure TTFB, and validate OpenGraph tags.",
  },
];

async function main() {
  const maxOrder =
    (await prisma.category.aggregate({ _max: { order: true } }))._max.order ??
    0;
  let order = Math.max(maxOrder, 9);
  for (const c of CATEGORIES) {
    const existing = await prisma.category.findUnique({
      where: { slug: c.slug },
      select: { id: true },
    });
    if (existing) {
      await prisma.category.update({ where: { slug: c.slug }, data: { ...c } });
    } else {
      order += 1;
      await prisma.category.create({
        data: { ...c, order, robotsIndex: true },
      });
    }
  }
  console.log(
    "tool categories ready:",
    CATEGORIES.map((c) => c.slug).join(", "),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
