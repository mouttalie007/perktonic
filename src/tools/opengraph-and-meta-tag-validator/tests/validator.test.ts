import { afterEach, describe, expect, it, vi } from "vitest";
import { extractTags } from "../src/logic/extract";
import { readImageInfo } from "../src/logic/image";
import { fixSnippet, reportText } from "../src/logic/report";
import { run } from "../src/logic/run";
import { normalizeUrl } from "../src/logic/url";
import { sameUrl } from "../src/logic/validate";
import { gifHeader, jpegHeader, pngHeader, webpHeader } from "../fixtures/images";
import { mockFetcher, type FakePage } from "../fixtures/mockFetcher";
import { EXAMPLE_URL, GOOD, HEAVY, NODEJS, PROBLEMS } from "../fixtures/sites";

const check = async (pages: Record<string, FakePage>, url: string) => {
  const m = mockFetcher(pages);
  return { result: await run({ url }, { fetcher: m.fetcher }), calls: m.calls };
};
const messages = (r: Awaited<ReturnType<typeof run>>, severity?: string) => r.issues.filter((i) => !severity || i.severity === severity).map((i) => i.message).join("\n");

describe("tags", () => {
  it("extracts title, description, canonical, robots, OpenGraph and Twitter tags from a real page", async () => {
    const { result } = await check(NODEJS, EXAMPLE_URL);
    expect(result.tags.titles).toEqual(["Node.js — Run JavaScript Everywhere"]);
    expect(result.tags.description).toMatch(/^Node\.js® is a free, open-source/);
    expect(result.tags.canonicals).toEqual(["https://nodejs.org/en"]);
    expect(result.tags.robots).toBe("index, follow");
    expect(result.tags.lang).toBe("en-GB");
    expect(result.tags.twitter["twitter:card"]).toBe("summary");
    expect(result.tags.og["og:image"]?.[0]).toContain("/en/next-data/og/announcement/");
  });

  it("decodes entities and reads twitter tags written with property=", () => {
    const t = extractTags('<head><meta property="og:title" content="Join the world&#39;s &amp; more"><meta property="twitter:card" content="summary"></head>');
    expect(t.og["og:title"]).toEqual(["Join the world's & more"]);
    expect(t.twitter["twitter:card"]).toBe("summary");
  });
});

describe("images", () => {
  it("reads PNG, JPEG, GIF and WebP sizes from the first bytes", () => {
    expect(readImageInfo(pngHeader(1200, 630))).toEqual({ type: "png", width: 1200, height: 630 });
    expect(readImageInfo(jpegHeader(1000, 1000))).toEqual({ type: "jpeg", width: 1000, height: 1000 });
    expect(readImageInfo(gifHeader(150, 150))).toEqual({ type: "gif", width: 150, height: 150 });
    expect(readImageInfo(webpHeader(1200, 630))).toEqual({ type: "webp", width: 1200, height: 630 });
    expect(readImageInfo(new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>')).type).toBe("svg");
    expect(readImageInfo(new TextEncoder().encode("<html>")).type).toBe("unknown");
  });

  it("resolves a relative og:image, fetches it through safeFetch with a byte cap and flags it below 200×200", async () => {
    const { result, calls } = await check(PROBLEMS, "https://blog.example.com/post/42");
    const img = calls.find((c) => c.url.endsWith("thumb.gif"));
    expect(img?.opts.maxBytes).toBe(2_000_000);
    expect(result.image).toMatchObject({ url: "https://blog.example.com/img/thumb.gif", width: 150, height: 150 });
    expect(messages(result, "warning")).toMatch(/og:image is a relative URL \(\/img\/thumb\.gif\)/);
    expect(messages(result, "error")).toMatch(/150×150; Facebook requires at least 200×200/);
  });

  it("flags images over 5 MB, the wrong ratio and mismatched declared sizes", async () => {
    const { result } = await check(HEAVY, "https://shop.example.com/p/kettle");
    expect(messages(result, "error")).toMatch(/6\.0 MB\. X rejects images over 5 MB/);
    expect(messages(result, "warning")).toMatch(/ratio is 1\.00:1, not 1\.91:1/);
    expect(messages(result, "warning")).toMatch(/og:image:width\/height say 1200×630, but the image is 1000×1000/);
    expect(fixSnippet(result)).toContain('<meta property="og:image:width" content="1000">');
  });

  it("follows redirects for the page and the image and accepts a correct setup", async () => {
    const { result } = await check(GOOD, "http://good.example.org/");
    expect(result.finalUrl).toBe("https://good.example.org/");
    expect(result.redirects).toEqual(["http://good.example.org/"]);
    expect(result.image).toMatchObject({ url: "https://img.example.org/share-1200.webp", type: "webp", width: 1200, height: 630 });
    expect(result.issues.filter((i) => i.severity === "error" || i.severity === "warning")).toEqual([]);
    expect(messages(result, "good")).toMatch(/1200×630 \(ratio 1\.90:1\)/);
    expect(result.previews.facebook.layout).toBe("large");
    expect(result.previews.facebook.image?.dataUrl).toMatch(/^data:image\/webp;base64,/);
  });
});

describe("rules", () => {
  it("validates twitter:card values, canonical vs final URL and robots noindex", async () => {
    const { result } = await check(PROBLEMS, "https://blog.example.com/post/42");
    const errors = messages(result, "error");
    expect(errors).toMatch(/twitter:card "large_image" is not a valid type/);
    expect(errors).toMatch(/noindex by a robots meta tag/);
    expect(messages(result, "warning")).toMatch(/canonical URL \(https:\/\/blog\.example\.com\/posts\/42\/\) is not the URL that was loaded/);
    expect(messages(result, "warning")).toMatch(/og:url .* and the canonical URL .* differ/);
  });

  it("notices X-Robots-Tag noindex and a missing og:image", async () => {
    const pages = { "https://a.example/": { status: 200, headers: { "content-type": "text/html", "x-robots-tag": "noindex" }, body: "<html><head><title>A page with a title</title></head></html>" } };
    const { result } = await check(pages, "https://a.example/");
    expect(messages(result, "error")).toMatch(/X-Robots-Tag header/);
    expect(messages(result, "error")).toMatch(/og:image is missing/);
    expect(result.previews.facebook.layout).toBe("none");
  });

  it("treats a summary card with a different twitter:image as information and builds per-platform previews", async () => {
    const { result } = await check(NODEJS, EXAMPLE_URL);
    expect(result.twitterImage).toMatchObject({ width: 224, height: 256 });
    expect(messages(result, "info")).toMatch(/twitter:image differs from og:image/);
    expect(result.previews.x).toMatchObject({ card: "summary", layout: "small", title: "Node.js — Run JavaScript Everywhere" });
    expect(result.previews.facebook.layout).toBe("large");
    expect(sameUrl("https://nodejs.org/en/", "https://nodejs.org/en")).toBe(true);
    expect(sameUrl("https://nodejs.org/en?x=1", "https://nodejs.org/en")).toBe(false);
  });

  it("rejects non-HTML responses, HTTP errors and private addresses", async () => {
    await expect(run({ url: "https://cdn.example.com/kettle.jpg" }, { fetcher: mockFetcher(HEAVY).fetcher })).rejects.toThrow(/not an HTML page/);
    await expect(run({ url: "https://x.example/" }, { fetcher: mockFetcher({ "https://x.example/": { status: 404, body: "<html>" } }).fetcher })).rejects.toThrow(/answered 404/);
    await expect(run({ url: "https://y.example/" }, { fetcher: mockFetcher({ "https://y.example/": { status: 0, error: "blocked_host" } }).fetcher })).rejects.toThrow(/private, local or reserved/);
    for (const bad of ["http://localhost:3000", "file:///etc/hosts", "https://a:b@example.com"]) expect(normalizeUrl(bad).ok, bad).toBe(false);
  });
});

describe("route and report", () => {
  afterEach(() => vi.resetModules());

  it("answers with the response contract and exports a text report", async () => {
    vi.doMock("@/lib/tools/safe-fetch", async (orig) => ({ ...(await orig<typeof import("@/lib/tools/safe-fetch")>()), safeFetch: mockFetcher(NODEJS).fetcher }));
    const { POST } = await import("../src/api/route");
    const post = (body: unknown) => POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) }));
    const ok = await (await post({ url: "nodejs.org/en" })).json();
    expect(ok.ok).toBe(true);
    expect(ok.data.previews.x.card).toBe("summary");
    const bad = await post({ url: "" });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("invalid_input");
    const { result } = await check(NODEJS, EXAMPLE_URL);
    expect(reportText(result)).toContain("Meta tag report for https://nodejs.org/en");
  });
});
