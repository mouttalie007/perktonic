import { afterEach, describe, expect, test, vi } from "vitest";
import * as rl from "@/lib/tools/rate-limit";
import { SafeFetchError } from "@/lib/tools/safe-fetch";
import { fakeClock, seqIds } from "../fixtures/clock";
import { mockFetcher } from "../fixtures/mockFetcher";
import { handleCapture } from "../src/api/capture";
import { handle } from "../src/api/route";
import { MemoryStore } from "../src/logic/memoryStore";

afterEach(() => vi.restoreAllMocks());
const post = (body: unknown, ip = "198.51.100.7") => new Request("http://localhost/api/tools/webhook-test-url-generator", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });

function setup(fetcher = mockFetcher({ status: 200, body: "pong" })) {
  const clock = fakeClock();
  const store = new MemoryStore(clock, seqIds());
  return { store, clock, fetcher, deps: { store, fetcher } };
}

describe("actions", () => {
  test("create, list, reply, clear, extend, delete", async () => {
    const { deps } = setup();
    const created = await (await handle(post({ action: "create" }), deps)).json();
    expect(created.ok).toBe(true);
    const id = created.data.id;
    expect(created.data).toMatchObject({ extensionsLeft: 3, reply: { status: 200, body: "ok" }, requests: [] });
    expect((await (await handle(post({ action: "reply", id, reply: { status: 201, contentType: "application/json", body: '{"received":true}', delayMs: 250 } }), deps)).json()).data.reply.status).toBe(201);
    expect((await handle(post({ action: "reply", id, reply: { status: 101, contentType: "text/plain", body: "", delayMs: 0 } }), deps)).status).toBe(400);
    expect((await handle(post({ action: "reply", id, reply: { status: 200, contentType: "text/plain", body: "x".repeat(10241), delayMs: 0 } }), deps)).status).toBe(400);
    expect((await handle(post({ action: "reply", id, reply: { status: 200, contentType: "text/plain", body: "", delayMs: 6000 } }), deps)).status).toBe(400);
    expect((await (await handle(post({ action: "extend", id }), deps)).json()).data.extensionsLeft).toBe(2);
    expect((await (await handle(post({ action: "clear", id }), deps)).json()).ok).toBe(true);
    expect((await (await handle(post({ action: "delete", id }), deps)).json()).data.deleted).toBe(true);
    expect((await handle(post({ action: "list", id }), deps)).status).toBe(404);
  });

  test("five active URLs per IP; a report deletes the endpoint", async () => {
    const { deps } = setup();
    let id = "";
    for (let i = 0; i < 5; i++) id = (await (await handle(post({ action: "create" }), deps)).json()).data.id;
    const sixth = await handle(post({ action: "create" }), deps);
    expect(sixth.status).toBe(429);
    expect((await sixth.json()).error.code).toBe("too_many_endpoints");
    await handle(post({ action: "report", id }), deps);
    expect((await handle(post({ action: "list", id }), deps)).status).toBe(404);
  });

  test("replay goes through safeFetch only, without hop-by-hop headers and host", async () => {
    const { deps, store, fetcher } = setup();
    const id = (await (await handle(post({ action: "create" }), deps)).json()).data.id;
    await handleCapture(new Request(`https://perktonic.com/hook/${id}?x=1`, { headers: { connection: "keep-alive", "x-token": "t", "user-agent": "Hookbot/2" } }), id, { store, clock: fakeClock(), sleep: async () => {} });
    const reqId = store.get(id)!.requests[0].id;
    const r = await (await handle(post({ action: "replay", id, requestId: reqId, url: "https://example.com/webhook" }), deps)).json();
    expect(r).toMatchObject({ ok: true, data: { status: 200, body: "pong" } });
    expect(fetcher.calls[0]).toMatchObject({ url: "https://example.com/webhook", opts: { method: "GET", headers: { "x-token": "t" }, userAgent: "Hookbot/2" } });
    expect(Object.keys(fetcher.calls[0].opts!.headers!)).not.toContain("connection");
  });

  test("replay refuses blocked hosts and bodies safeFetch cannot send", async () => {
    const { deps, store } = setup(mockFetcher(new SafeFetchError("blocked_host", "That address is not allowed.")));
    const id = (await (await handle(post({ action: "create" }), deps)).json()).data.id;
    const capDeps = { store, clock: fakeClock(), sleep: async () => {} };
    await handleCapture(new Request(`https://perktonic.com/hook/${id}`), id, capDeps);
    await handleCapture(new Request(`https://perktonic.com/hook/${id}`, { method: "POST", body: "{}" }), id, capDeps);
    const [postReq, getReq] = store.get(id)!.requests;
    const blocked = await handle(post({ action: "replay", id, requestId: getReq.id, url: "http://169.254.169.254/" }), deps);
    expect(blocked.status).toBe(400);
    expect((await blocked.json()).error.code).toBe("blocked_host");
    const p = await handle(post({ action: "replay", id, requestId: postReq.id, url: "https://example.com" }), deps);
    expect((await p.json()).error.message).toMatch(/GET and HEAD .* Copy as cURL/);
  });

  test("validation and rate limits (create: 10 per 10 minutes)", async () => {
    const { deps } = setup();
    expect((await handle(post({ action: "list", id: "short" }), deps)).status).toBe(400);
    expect((await handle(post({ action: "nope" }), deps)).status).toBe(400);
    expect((await handle(post({ action: "replay", id: "A".repeat(22), requestId: "r", url: "https://x.test/" + "a".repeat(2050) }), deps)).status).toBe(400);
    const spy = vi.spyOn(rl, "rateLimit").mockResolvedValue({ ok: false, remaining: 0, retryAfterSec: 120 });
    const res = await handle(post({ action: "create" }), deps);
    expect(res.status).toBe(429);
    expect(spy).toHaveBeenCalledWith(expect.any(Request), { bucket: "webhook-test-url-generator:create", limit: 10, windowSec: 600 });
  });
});
