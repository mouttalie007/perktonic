import { describe, expect, test } from "vitest";
import { fakeClock, seqIds } from "../fixtures/clock";
import { handleCapture, handleEvents } from "../src/api/capture";
import { MAX_BODY_BYTES } from "../src/limits";
import { asText, buildCapture, readCapped, visibleHeaders } from "../src/logic/capture";
import { toCurl, shellQuote } from "../src/logic/curl";
import { hexDump, pretty } from "../src/logic/format";
import { MemoryStore } from "../src/logic/memoryStore";

function setup() {
  const clock = fakeClock();
  const store = new MemoryStore(clock, seqIds());
  const e = store.create("1.2.3.4");
  if (!e.ok) throw new Error();
  const slept: number[] = [];
  const deps = { store, clock, sleep: async (ms: number) => void slept.push(ms) };
  const url = (q = "") => `https://perktonic.com/api/tools/webhook-test-url-generator/hook/${e.endpoint.id}${q}`;
  return { store, clock, id: e.endpoint.id, deps, slept, url };
}

describe("capturing requests", () => {
  test("every method is accepted; method, URL, query, headers, body, content type and sender are recorded", async () => {
    const { store, id, deps, url } = setup();
    for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
      const res = await handleCapture(new Request(url("?event=order.paid&n=1"), { method: m, headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9, 10.0.0.2", "x-signature": "abc" }, body: m === "GET" || m === "HEAD" ? undefined : '{"id":42}' }), id, deps);
      expect(res.status, m).toBe(200);
    }
    const reqs = store.get(id)!.requests;
    expect(reqs.map((r) => r.method)).toEqual(["OPTIONS", "HEAD", "DELETE", "PATCH", "PUT", "POST", "GET"]);
    const post = reqs.find((r) => r.method === "POST")!;
    expect(post).toMatchObject({ query: [["event", "order.paid"], ["n", "1"]], contentType: "application/json", ip: "203.0.113.9", body: { text: '{"id":42}', size: 9, truncated: false } });
    expect(post.headers.map(([k]) => k)).toEqual(["content-type", "x-signature"]);
  });

  test("our infrastructure headers are never echoed; headers are capped at 64 KB", () => {
    const v = visibleHeaders([["x-forwarded-for", "1.1.1.1"], ["x-real-ip", "1.1.1.1"], ["cf-ray", "x"], ["via", "1.1 proxy"], ["x-forwarded-proto", "https"], ["stripe-signature", "t=1"], ["x-big", "a".repeat(70000)]]);
    expect(v.headers).toEqual([["stripe-signature", "t=1"]]);
    expect(v.truncated).toBe(true);
  });

  test("a body over 256 KB is cut and flagged; binary bodies are kept as base64 and shown as hex", async () => {
    const big = new Uint8Array(MAX_BODY_BYTES + 1000).fill(65);
    const r = await readCapped(new Response(big).body);
    expect(r).toMatchObject({ truncated: true, size: MAX_BODY_BYTES + 1000 });
    expect(r.body.length).toBe(MAX_BODY_BYTES);
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const c = buildCapture({ method: "POST", url: "https://x.test/h", headers: [["content-type", "image/png"]], body: png, truncated: false, size: 10 }, "r1", new Date(0));
    expect(c.body.text).toBeNull();
    expect(c.body.base64).toBe("iVBORw0KGgoAAA==");
    expect(hexDump(png)).toBe("00000000  89 50 4e 47 0d 0a 1a 0a 00 00                    .PNG......");
    expect(asText(new TextEncoder().encode("é ok\n"), false)).toBe("é ok\n");
  });

  test("the custom response: status, type, body and delay; HEAD gets no body; the response is sandboxed", async () => {
    const { store, id, deps, url, slept } = setup();
    store.setReply(id, { status: 202, contentType: "text/html", body: "<b>accepted</b>", delayMs: 1500 });
    const res = await handleCapture(new Request(url(), { method: "POST", body: "x" }), id, deps);
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("<b>accepted</b>");
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
    expect(slept).toEqual([1500]);
    const head = await handleCapture(new Request(url(), { method: "HEAD" }), id, deps);
    expect(await head.text()).toBe("");
  });

  test("limits: 60 requests a minute (then 429), unknown or expired URLs 404, scanners 403", async () => {
    const { id, deps, url, clock } = setup();
    for (let i = 0; i < 60; i++) await handleCapture(new Request(url()), id, deps);
    expect((await handleCapture(new Request(url()), id, deps)).status).toBe(429);
    expect((await handleCapture(new Request(url(), { headers: { "user-agent": "sqlmap/1.7" } }), id, deps)).status).toBe(403);
    expect((await handleCapture(new Request(url()), "bad", deps)).status).toBe(404);
    clock.advance(61 * 60_000);
    expect((await handleCapture(new Request(url()), id, deps)).status).toBe(404);
  });

  test("live view: SSE headers, a capture event, a heartbeat and the end on delete", async () => {
    const { store, id, deps, url } = setup();
    const ctrl = new AbortController();
    const res = handleEvents(new Request(url(), { signal: ctrl.signal }), id, { store, heartbeatMs: 5 });
    expect(res.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    expect(res.headers.get("cache-control")).toBe("no-store, no-transform");
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let got = dec.decode((await reader.read()).value);
    await handleCapture(new Request(url("?a=1"), { method: "POST", body: "hi" }), id, deps);
    got += dec.decode((await reader.read()).value);
    expect(got).toContain("event: capture");
    expect(got).toContain('"text":"hi"');
    await new Promise((r) => setTimeout(r, 15));
    got += dec.decode((await reader.read()).value);
    expect(got).toContain(": ping");
    store.remove(id);
    let done = false;
    while (!done) {
      const r = await reader.read();
      if (r.value) got += dec.decode(r.value);
      done = r.done;
    }
    expect(got).toContain("event: deleted");
    expect(handleEvents(new Request(url()), id, { store }).status).toBe(404);
  });
});

describe("copy as cURL and pretty views", () => {
  const c = buildCapture({ method: "POST", url: "https://h.test/hook/x?a=1&b=it's", headers: [["content-type", "application/json"], ["host", "h.test"], ["x-note", "it's fine"]], body: new TextEncoder().encode('{"msg":"it\'s ok"}'), truncated: false, size: 17 }, "r", new Date(0));
  test("shell quoting of URL, headers and body", () => {
    expect(shellQuote("it's")).toBe(`'it'\\''s'`);
    expect(toCurl(c)).toBe(`curl \\\n  -X POST \\\n  'https://h.test/hook/x?a=1&b=it%27s' \\\n  -H 'content-type: application/json' \\\n  -H 'x-note: it'\\''s fine' \\\n  --data-binary '{"msg":"it'\\''s ok"}'`);
  });
  test("JSON and form bodies get a pretty view", () => {
    expect(pretty(c)).toEqual({ kind: "json", text: '{\n  "msg": "it\'s ok"\n}' });
    const form = buildCapture({ method: "POST", url: "https://h.test/x", headers: [["content-type", "application/x-www-form-urlencoded"]], body: new TextEncoder().encode("a=1&b=two+words"), truncated: false, size: 15 }, "r", new Date(0));
    expect(pretty(form)).toEqual({ kind: "form", text: "a = 1\nb = two words" });
  });
});
