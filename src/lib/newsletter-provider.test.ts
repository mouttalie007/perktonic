import { describe, expect, it, vi } from "vitest";
import { providerEnabled, providerSubscribe, providerUnsubscribe } from "./newsletter-provider";

const cfg = { provider: "mailerlite", apiKey: "k".repeat(20), groupId: "123" };

describe("newsletter provider", () => {
  it("is on only for mailerlite with a key", () => {
    expect(providerEnabled(cfg)).toBe(true);
    expect(providerEnabled({ ...cfg, provider: "" })).toBe(false);
    expect(providerEnabled({ ...cfg, apiKey: "" })).toBe(false);
  });
  it("posts the subscriber with the group and the bearer key", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    expect(await providerSubscribe(cfg, "a@b.co", f as unknown as typeof fetch)).toBe(true);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://connect.mailerlite.com/api/subscribers");
    expect(init.headers.Authorization).toBe(`Bearer ${cfg.apiKey}`);
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.co", groups: ["123"] });
  });
  it("sends the unsubscribed status and reports a refusal", async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 422 });
    expect(await providerUnsubscribe(cfg, "a@b.co", f as unknown as typeof fetch)).toBe(false);
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ email: "a@b.co", status: "unsubscribed" });
  });
});
