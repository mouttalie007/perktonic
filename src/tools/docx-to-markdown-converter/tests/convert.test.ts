import { createDocument } from "@mixmark-io/domino";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ConvertError, docxToMarkdown } from "../src/logic/fromDocx";
import { extractFootnotes, imageSize, markdownToDocx } from "../src/logic/toDocx";
import { htmlToMarkdown, type DomDocument } from "../src/logic/toMarkdown";
import { SAMPLE_MARKDOWN } from "../fixtures/sampleMarkdown";

const sample = new Uint8Array(readFileSync(new URL("../fixtures/sample.docx", import.meta.url)));
const dom = (html: string) => createDocument(`<!doctype html><html><body>${html}</body></html>`) as unknown as DomDocument;

describe("Word → Markdown", () => {
  it("keeps headings, lists, tables, links and code, and extracts images into a ZIP", async () => {
    const r = await docxToMarkdown(sample, "zip");
    const md = r.markdown;
    expect(md).toContain("# Checkout redesign brief");
    expect(md).toContain("## Goals");
    expect(md).toContain("- Cut checkout to two steps\n  - Address lookup by postcode");
    expect(md).toContain("1. Prototype and test with 8 customers\n2. Build behind a feature flag");
    expect(md).toContain("| **Item** | **Owner** | **Cost (EUR)** |\n| --- | --- | --- |\n| Design sprint | Ada | 6,000 |");
    expect(md).toContain("[analytics dashboard](https://example.com/analytics/checkout)");
    expect(md).toContain('```\nanalytics.track("checkout_step", {\n  step: "address",');
    expect(md).toContain("![Conversion by checkout step](images/image1.png)");
    const files = unzipSync(r.zip!);
    expect(Object.keys(files).sort()).toEqual(["document.md", "images/image1.png"]);
    expect(strFromU8(files["document.md"])).toBe(md);
    expect(Array.from(files["images/image1.png"].slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(r.stats).toMatchObject({ tables: 1, images: 1, links: 1, codeBlocks: 1, footnotes: 2 });
  });

  it("can keep images inside the Markdown as data URIs instead", async () => {
    const r = await docxToMarkdown(sample, "inline");
    expect(r.zip).toBeNull();
    expect(r.markdown).toMatch(/!\[Conversion by checkout step\]\(data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+\)/);
  });

  it("turns footnotes into Markdown footnotes and lists every unsupported feature with a count", async () => {
    const r = await docxToMarkdown(sample, "zip");
    expect(r.markdown).toContain("on desktop[^1].");
    expect(r.markdown).toContain("- Add wallet payments[^2]");
    expect(r.markdown).toContain("[^1]: Measured over 30 days in September 2026.");
    expect(r.markdown).toContain("[^2]: Apple Pay and Google Pay, behind a feature flag.");
    expect(r.markdown).not.toContain("↑");
    // The tracked change was accepted: 10% kept, 50% removed.
    expect(r.markdown).toContain("Roll out to 10% of traffic");
    expect(r.markdown).not.toContain("50%");
    expect(r.warnings.map((w) => [w.feature, w.count, w.level])).toEqual([
      ["Footnotes", 2, "changed"],
      ["Comments", 1, "lost"],
      ["Tracked changes", 2, "changed"],
      ["Text boxes", 1, "changed"],
      ["Equations", 1, "lost"],
      ["Headers and footers", 2, "lost"],
    ]);
  });

  it("refuses old .doc files, PDFs and other ZIP files with a clear message", async () => {
    await expect(docxToMarkdown(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]), "zip")).rejects.toThrow("This is an old Word .doc file (Word 97–2003)");
    await expect(docxToMarkdown(strToU8("%PDF-1.7"), "zip")).rejects.toThrow("This is a PDF, not a Word document.");
    await expect(docxToMarkdown(zipSync({ "xl/workbook.xml": strToU8("<x/>") }), "zip")).rejects.toThrow(/not a Word document/);
    await expect(docxToMarkdown(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), "zip")).rejects.toThrow(ConvertError);
  });

  it("gives tables without a header row a header and pads merged cells", () => {
    const r = htmlToMarkdown(dom('<table><tr><td colspan="2">Q1</td><td>Q2</td></tr><tr><td rowspan="2">North</td><td>4</td><td>5</td></tr><tr><td>6</td><td>7</td></tr></table>'));
    expect(r.headerlessTables).toBe(1);
    expect(r.markdown.trim().split("\n")).toEqual(["| Q1  |     | Q2  |", "| --- | --- | --- |", "| North | 4   | 5   |", "|     | 6   | 7   |"]);
    // A 1.5 MB data: URI goes through intact (and quickly: it is swapped out while turndown runs).
    const uri = `data:image/png;base64,${"A".repeat(1_500_000)}`;
    const big = htmlToMarkdown(dom(`<p><img alt="scan" src="${uri}"></p>`));
    expect(big.markdown.trim()).toBe(`![scan](${uri})`);
  });
});

describe("Markdown → Word", () => {
  it("keeps headings, lists, tables, code blocks, links, images and footnotes (checked by reading the .docx back)", async () => {
    const r = await markdownToDocx(SAMPLE_MARKDOWN, "Release notes");
    expect(Array.from(r.docx.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(r.stats).toMatchObject({ headings: 4, tables: 1, codeBlocks: 1, images: 1, links: 1, footnotes: 1, lists: 2 });
    const back = await docxToMarkdown(r.docx, "zip");
    const md = back.markdown;
    expect(md).toContain("# Release notes: checkout v2");
    expect(md).toContain("**mobile**");
    expect(md).toContain("behind the `checkout_v2` flag");
    expect(md).toContain("[^1]: Measured on 30 days of September 2026 traffic.");
    expect(md).toContain("| **Step** | **Before** | **After** |");
    expect(md).toContain("| Address | 41% drop-off | 18% drop-off |");
    expect(md).toContain('```\nanalytics.track("checkout_step", { step: "address", ms: 5400 });\n```');
    expect(md).toContain("- Address lookup by postcode\n  - UK and Ireland first");
    expect(md).toContain("☑ Load testing done");
    expect(md).toContain("1. 10% of traffic for one week");
    expect(md).toContain("[the checkout channel](https://example.com/chat/checkout)");
    expect(Object.keys(unzipSync(back.zip!))).toContain("images/image1.png");
  });

  it("warns about what Word cannot hold instead of dropping it silently", async () => {
    const r = await markdownToDocx("Hi[^a] and [^b]\n\n[^a]: Used.\n[^z]: Never used.\n\n![remote](https://example.com/x.png)\n\n<div>raw</div>\n\n[anchor](#top)\n");
    expect(r.warnings.map((w) => [w.feature, w.count])).toEqual([
      ["Images from the web", 1],
      ["HTML blocks", 1],
      ["Links that are not web addresses", 1],
      ["Footnotes never referenced", 1],
    ]);
    expect(r.stats.footnotes).toBe(1);
    const fn = extractFootnotes("```\n[^x]: not a note\n```\n[^y]: a note\n  continued");
    expect([...fn.notes.entries()]).toEqual([["y", { id: 1, text: "a note continued" }]]);
    expect(fn.body).toContain("[^x]: not a note");
  });

  it("reads image sizes from PNG, GIF and JPEG headers", () => {
    expect(imageSize(new Uint8Array(readFileSync(new URL("../fixtures/chart.png", import.meta.url))))).toEqual({ width: 96, height: 48, type: "png" });
    expect(imageSize(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x00, 0x10, 0x00, 0, 0]))).toEqual({ width: 32, height: 16, type: "gif" });
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x00, 0x02, 0x00, 0x03, 0, 0, 0, 0, 0, 0]);
    expect(imageSize(jpeg)).toEqual({ width: 512, height: 256, type: "jpg" });
  });

  it("round-trips a large document (2,000 paragraphs, 100 tables)", async () => {
    const parts: string[] = [];
    for (let i = 0; i < 100; i++) {
      parts.push(`## Section ${i}`);
      for (let p = 0; p < 20; p++) parts.push(`Paragraph ${i}.${p} with **bold**, *italic* and a [link](https://example.com/${i}/${p}).`);
      parts.push("| a | b |\n|---|---|\n| 1 | 2 |");
    }
    const big = await markdownToDocx(parts.join("\n\n"));
    const back = await docxToMarkdown(big.docx, "inline");
    expect(back.stats).toMatchObject({ headings: 100, tables: 100, links: 2000 });
    expect(back.markdown).toContain("Paragraph 99.19 with **bold**, *italic* and a [link](https://example.com/99/19).");
  }, 60_000);
});

describe("the page's opening state", () => {
  it("shows exactly what the converter produces for the example (no worker needed on load)", async () => {
    const { SAMPLE_RESULT } = await import("../fixtures/sampleResult");
    const r = await docxToMarkdown(sample, "zip");
    const live = { markdown: r.markdown, warnings: r.warnings, stats: r.stats, imageCount: r.imageCount };
    if (process.env.UPDATE_SAMPLE) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(new URL("../fixtures/sampleResult.ts", import.meta.url), `import type { DocStats, Warning } from "../src/logic/types";\n\n/**\n * The converter's output for fixtures/sample.docx, shown when the page opens so\n * the converter does not have to load first. A test keeps it identical to a live\n * conversion; regenerate with UPDATE_SAMPLE=1 npx vitest run src/tools/docx-to-markdown-converter.\n */\nexport const SAMPLE_RESULT: { markdown: string; warnings: Warning[]; stats: DocStats; imageCount: number } = ${JSON.stringify(live, null, 2)};\n`);
      return;
    }
    expect(SAMPLE_RESULT).toEqual(live);
  });
});
