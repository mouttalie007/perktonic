import type { CategoryKey } from "./site";

/**
 * Registry of PerkTonic's online tools: the single source for the homepage
 * "Popular Tools" row, the /tools hub and each /tools/<slug> page.
 *
 * A tool is `soon` until its own page exists. To ship a tool: build
 * `src/app/(site)/tools/<slug>/page.tsx` (it wins over the generic placeholder
 * route) and flip `status` to "live". Only live tools are listed in the sitemap.
 */
export type ToolStatus = "live" | "soon";

export interface ToolDef {
  slug: string;
  name: string;
  description: string;
  categorySlug: CategoryKey;
  /** ToolIcon key. */
  iconKey: string;
  status: ToolStatus;
  /** Shown first on the homepage / hub. */
  popular?: boolean;
}

export const TOOLS: ToolDef[] = [
  {
    slug: "excel-formula-generator",
    name: "Excel Formula Generator",
    description: "Create and explain Excel formulas instantly.",
    categorySlug: "spreadsheet-studio",
    iconKey: "sheet",
    status: "soon",
    popular: true,
  },
  {
    slug: "csv-to-json-converter",
    name: "CSV to JSON Converter",
    description: "Convert between CSV, JSON, Excel and more.",
    categorySlug: "data-converters",
    iconKey: "swap",
    status: "soon",
    popular: true,
  },
  {
    slug: "pdf-to-excel",
    name: "PDF to Excel (Table Extractor)",
    description: "Extract tables from PDFs into editable Excel files.",
    categorySlug: "document-intelligence",
    iconKey: "pdf",
    status: "soon",
    popular: true,
  },
  {
    slug: "regex-generator-tester",
    name: "Regex Generator & Tester",
    description: "Build and test regular expressions easily.",
    categorySlug: "workflow-automation",
    iconKey: "code",
    status: "soon",
    popular: true,
  },
  {
    slug: "cron-expression-generator",
    name: "Cron Expression Generator",
    description: "Create and understand cron job schedules.",
    categorySlug: "workflow-automation",
    iconKey: "clock",
    status: "soon",
    popular: true,
  },
  {
    slug: "redirect-chain-checker",
    name: "Redirect Chain Checker",
    description: "Trace 301/302 redirects and check status codes.",
    categorySlug: "web-diagnostics",
    iconKey: "globe-purple",
    status: "soon",
    popular: true,
  },
];

export const toolHref = (t: Pick<ToolDef, "slug">) => `/tools/${t.slug}`;
export const popularTools = () => TOOLS.filter((t) => t.popular);
export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug);

/** Searches shown as chips under the hero search box. */
export const POPULAR_SEARCHES = [
  "excel formula",
  "pdf to excel",
  "csv to json",
  "regex tester",
  "meta tag checker",
];
