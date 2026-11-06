import { describe, expect, test } from "vitest";
import { fakeClock, seqIds } from "../fixtures/clock";
import { CAPTURES_PER_MINUTE, MAX_ACTIVE_PER_IP, MAX_ENDPOINTS, MAX_REQUESTS } from "../src/limits";
import { buildCapture } from "../src/logic/capture";
import { isId, newId } from "../src/logic/ids";
import { MemoryStore } from "../src/logic/memoryStore";
import type { StoreEvent } from "../src/logic/store";

const cap = (n: number) => buildCapture({ method: "POST", url: `https://perktonic.com/api/tools/webhook-test-url-generator/hook/x?n=${n}`, headers: [], body: new Uint8Array(0), truncated: false, size: 0 }, `r${n}`, new Date(0));

describe("in-memory store with a fake clock", () => {
  test("ids are 128-bit random and URL-safe", () => {
    const ids = new Set(Array.from({ length: 200 }, newId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(isId(id)).toBe(true);
  });

  test("an endpoint lives 60 minutes, can be extended 3 times, then expires and is swept", () => {
    const clock = fakeClock();
    const s = new MemoryStore(clock, seqIds());
    const e = s.create("1.1.1.1");
    if (!e.ok) throw new Error("create failed");
    clock.advance(59 * 60_000);
    expect(s.get(e.endpoint.id)).not.toBeNull();
    for (let i = 0; i < 3; i++) expect(s.extend(e.endpoint.id)).toMatchObject({ ok: true, endpoint: { extensionsLeft: 2 - i } });
    expect(s.extend(e.endpoint.id)).toEqual({ ok: false, code: "no_more_extensions" });
    clock.advance(60 * 60_000);
    expect(s.get(e.endpoint.id)).toBeNull();
    const f = s.create("1.1.1.1");
    clock.advance(61 * 60_000);
    expect(f.ok && s.sweep()).toBe(1);
    expect(s.size()).toBe(0);
  });

  test("at most 5 active endpoints per IP and 2,000 in total", () => {
    const s = new MemoryStore(fakeClock(), seqIds());
    for (let i = 0; i < MAX_ACTIVE_PER_IP; i++) expect(s.create("2.2.2.2").ok).toBe(true);
    expect(s.create("2.2.2.2")).toEqual({ ok: false, code: "too_many_for_ip" });
    expect(s.create("3.3.3.3").ok).toBe(true);
    const big = new MemoryStore(fakeClock(), seqIds("B"));
    for (let i = 0; i < MAX_ENDPOINTS; i++) big.create(`10.0.${Math.floor(i / 250)}.${i % 250}`);
    expect(big.create("9.9.9.9")).toEqual({ ok: false, code: "full" });
  });

  test("the last 50 requests are kept (newest first); 60 per minute are accepted", () => {
    const clock = fakeClock();
    const s = new MemoryStore(clock, seqIds());
    const e = s.create("4.4.4.4");
    if (!e.ok) throw new Error();
    for (let i = 0; i < 70; i++) s.add(e.endpoint.id, cap(i));
    const reqs = s.get(e.endpoint.id)!.requests;
    expect(reqs).toHaveLength(MAX_REQUESTS);
    expect(reqs[0].id).toBe("r69");
    expect(reqs.at(-1)!.id).toBe("r20");
    for (let i = 0; i < CAPTURES_PER_MINUTE; i++) expect(s.hit(e.endpoint.id)).toBe(true);
    expect(s.hit(e.endpoint.id)).toBe(false);
    clock.advance(60_001);
    expect(s.hit(e.endpoint.id)).toBe(true);
  });

  test("listeners hear captures, clears, updates and deletion", () => {
    const s = new MemoryStore(fakeClock(), seqIds());
    const e = s.create("5.5.5.5");
    if (!e.ok) throw new Error();
    const events: StoreEvent["type"][] = [];
    s.subscribe(e.endpoint.id, (ev) => events.push(ev.type));
    s.add(e.endpoint.id, cap(1));
    s.setReply(e.endpoint.id, { status: 201, contentType: "application/json", body: "{}", delayMs: 0 });
    s.clear(e.endpoint.id);
    s.remove(e.endpoint.id);
    expect(events).toEqual(["capture", "updated", "cleared", "deleted"]);
    expect(s.get(e.endpoint.id)).toBeNull();
  });
});
