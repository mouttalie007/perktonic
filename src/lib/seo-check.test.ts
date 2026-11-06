import { describe, expect, it } from "vitest";
import { seoCheck, seoScore, type SeoCheckInput } from "./seo-check";

const body = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const good: SeoCheckInput = {
  title: "Fix #REF! in Excel VLOOKUP: Causes and Fixes",
  slug: "fix-ref-error-excel-vlookup",
  excerpt: "Why VLOOKUP returns #REF! and how to correct the column index or the range in a few steps.",
  seoTitle: "",
  metaDescription: "Find out why VLOOKUP returns #REF! in Excel, how to read the three most common causes and how to fix the formula, with a worked example you can try.",
  html: `<h2>Cause</h2><p>${body(200)}</p><h2>Fix</h2><p>${body(200)} <a href="/tools/excel-formula-debugger">Excel Formula Debugger</a> and <a href="/tools/xlookup-vs-index-match-generator">XLOOKUP</a> and <a href="https://support.microsoft.com/vlookup">docs</a></p><img src="/a.webp" alt="Likely causes panel showing VLOOKUP asks for column 4 of a 3 column table"><p>${body(120)}</p>`,
  hasFeaturedImage: true,
  siteHost: "perktonic.com",
};
const by = (checks: ReturnType<typeof seoCheck>, id: string) => checks.find((c) => c.id === id)!;

describe("seoCheck", () => {
  it("passes a well formed technical article", () => {
    const c = seoCheck(good);
    expect(c.filter((x) => x.status === "bad")).toEqual([]);
    expect(seoScore(c)).toBeGreaterThanOrEqual(90);
  });
  it("flags a long title and a short description", () => {
    const c = seoCheck({ ...good, title: "x".repeat(70), metaDescription: "too short" });
    expect(by(c, "title").status).toBe("warn");
    expect(by(c, "desc").status).toBe("warn");
  });
  it("requires alt text and a link to a tool", () => {
    const c = seoCheck({ ...good, html: `<h2>a</h2><h2>b</h2><p>${body(300)}</p><img src="/a.webp">` });
    expect(by(c, "img").status).toBe("bad");
    expect(by(c, "tool").status).toBe("bad");
  });
  it("rejects an H1 in the body and a file name as alt text", () => {
    expect(by(seoCheck({ ...good, html: `<h1>Title</h1>${good.html}` }), "h1").status).toBe("bad");
    expect(by(seoCheck({ ...good, html: good.html.replace(/alt="[^"]*"/, 'alt="screenshot-1.png"') }), "img").status).toBe("warn");
  });
  it("catches hype wording, long dashes and long paragraphs", () => {
    const c = seoCheck({ ...good, html: `${good.html}<p>This ultimate guide — amazing. ${body(130)}</p>` });
    expect(by(c, "tone").status).toBe("warn");
    expect(by(c, "dash").status).toBe("warn");
    expect(by(c, "paras").status).toBe("warn");
  });
  it("tells internal from external links", () => {
    const c = seoCheck({ ...good, html: `<h2>a</h2><h2>b</h2><p>${body(300)} <a href="https://perktonic.com/tools/x">x</a> <a href="https://www.perktonic.com/blog/y">y</a></p>` });
    expect(by(c, "tool").status).toBe("ok");
    expect(by(c, "external").status).toBe("warn");
  });
});
