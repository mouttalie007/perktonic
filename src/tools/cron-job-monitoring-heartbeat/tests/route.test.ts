import { afterEach, describe, expect, test, vi } from "vitest";
import * as rl from "@/lib/tools/rate-limit";
import { fakeDeps, MIN } from "../fixtures/fakes";
import { handlePing } from "../src/api/ping";
import { handle } from "../src/api/route";

afterEach(() => vi.restoreAllMocks());
const post = (body: unknown) => new Request("https://perktonic.com/api/tools/cron-job-monitoring-heartbeat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const create = { action: "create", name: "Invoice export", intervalSec: 3600, graceSec: 600, emails: [], webhookUrl: null, telegramChatId: null };

describe("actions and ping URLs", () => {
  test("create returns the two secret links once; view, pause, resume, delete", async () => {
    const f = fakeDeps();
    const c = await (await handle(post(create), f.deps)).json();
    expect(c.ok).toBe(true);
    const { manageToken, pingToken } = c.data;
    expect(c.data.monitor).toMatchObject({ state: "new", name: "Invoice export" });
    expect(JSON.stringify((await (await handle(post({ action: "view", manage: manageToken }), f.deps)).json()).data)).not.toContain(pingToken);
    expect((await (await handle(post({ action: "pause", manage: manageToken }), f.deps)).json()).data.paused).toBe(true);
    expect((await (await handle(post({ action: "resume", manage: manageToken }), f.deps)).json()).data.paused).toBe(false);
    expect((await (await handle(post({ action: "delete", manage: manageToken }), f.deps)).json()).data.deleted).toBe(true);
    expect((await handle(post({ action: "view", manage: manageToken }), f.deps)).status).toBe(404);
    expect((await handlePing(new Request("https://x/ping"), pingToken, "success", f.deps)).status).toBe(404);
  });

  test("ping URL: GET, POST and HEAD answer 200 ok at once; /fail keeps at most 1 KB; other methods 405", async () => {
    const f = fakeDeps();
    const { pingToken, manageToken } = (await (await handle(post(create), f.deps)).json()).data;
    const ping = (method: string, kind: "success" | "fail" | "start" = "success", body?: string) => handlePing(new Request("https://perktonic.com/p", { method, body }), pingToken, kind, f.deps);
    const g = await ping("GET");
    expect([g.status, await g.text()]).toEqual([200, "ok\n"]);
    f.advance(MIN);
    expect((await ping("HEAD")).status).toBe(200);
    f.advance(MIN);
    expect((await ping("POST", "fail", "x".repeat(5000))).status).toBe(200);
    const v = (await (await handle(post({ action: "view", manage: manageToken }), f.deps)).json()).data;
    expect(v.state).toBe("down");
    expect(v.failMessage).toHaveLength(1024);
    expect(v.pings.map((p: { kind: string }) => p.kind)).toEqual(["fail", "success", "success"]);
    expect((await ping("PUT")).status).toBe(405);
  });

  test("validation: name, interval (1 minute to 7 days), grace (1 minute to 1 day), 2 emails, URLs", async () => {
    const f = fakeDeps();
    for (const bad of [{ name: "" }, { name: "x".repeat(61) }, { intervalSec: 30 }, { intervalSec: 8 * 86400 }, { graceSec: 30 }, { graceSec: 2 * 86400 }, { emails: ["a@b.co", "c@d.co", "e@f.co"] }, { emails: ["nope"] }, { webhookUrl: "ftp://x" }, { telegramChatId: "abc" }]) {
      expect((await handle(post({ ...create, ...bad }), f.deps)).status, JSON.stringify(bad)).toBe(400);
    }
  });

  test("rate limits: 3 monitors per IP per day, 60 pings per minute per URL", async () => {
    const f = fakeDeps();
    const spy = vi.spyOn(rl, "rateLimit").mockResolvedValue({ ok: false, remaining: 0, retryAfterSec: 3600 });
    const res = await handle(post(create), f.deps);
    expect(res.status).toBe(429);
    expect(spy).toHaveBeenLastCalledWith(expect.any(Request), { bucket: "cron-job-monitoring-heartbeat:create", limit: 3, windowSec: 86400 });
    expect((await handlePing(new Request("https://x/p"), "A".repeat(22), "success", f.deps)).status).toBe(429);
    expect(spy.mock.calls.at(-1)![1]).toMatchObject({ limit: 60, windowSec: 60 });
  });
});
