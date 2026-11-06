import { describe, expect, it } from "vitest";
import { normalizeHost } from "../src/logic/host";
import { explainAuthError, run } from "../src/logic/inspect";
import { mockTls, NOW } from "../fixtures/certs";

const deps = () => {
  const m = mockTls();
  return { tls: m.tls, calls: m.calls, now: () => NOW };
};
const byId = (r: { checks: { id: string; level: string; title: string }[] }, id: string) => r.checks.find((c) => c.id === id);

describe("input", () => {
  it("accepts names, URLs and host:port, allows only ports 443, 465, 993, 995 and 8443, and refuses private addresses", () => {
    expect(normalizeHost("Shop.Example.com")).toEqual({ ok: true, host: "shop.example.com", port: 443 });
    expect(normalizeHost("https://shop.example.com:8443/login")).toEqual({ ok: true, host: "shop.example.com", port: 8443 });
    expect(normalizeHost("mail.example.com", 993)).toEqual({ ok: true, host: "mail.example.com", port: 993 });
    expect(normalizeHost("shop.example.com:22")).toEqual({ ok: false, error: "Port 22 cannot be checked. Allowed ports: 443, 465, 993, 995, 8443." });
    expect(normalizeHost("203.0.113.20")).toMatchObject({ ok: true, host: "203.0.113.20" });
    for (const bad of ["localhost", "192.168.1.1", "10.0.0.8:443", "[::1]", "nas.local", "intranet"]) expect(normalizeHost(bad).ok, bad).toBe(false);
  });
});

describe("a check", () => {
  it("reads a valid certificate: days left, name, chain, key and protocol versions over 5 parallel connections", async () => {
    const d = deps();
    const r = await run({ host: "shop.example.com" }, d);
    expect(d.calls.map((c) => c.version ?? "main")).toEqual(["main", "TLSv1", "TLSv1.1", "TLSv1.2", "TLSv1.3"]);
    expect(r.daysLeft).toBe(54);
    expect(r.verdict).toEqual({ level: "good", text: "The certificate is valid, trusted and covers shop.example.com. It expires in 54 days." });
    expect(r.versions.map((v) => [v.version, v.accepted])).toEqual([
      ["TLSv1", false],
      ["TLSv1.1", false],
      ["TLSv1.2", true],
      ["TLSv1.3", true],
    ]);
    expect(r.chain.map((c) => [c.role, c.commonName])).toEqual([
      ["leaf", "shop.example.com"],
      ["intermediate", "R11"],
      ["root", "ISRG Root X1"],
    ]);
    expect(r.checks.map((c) => [c.id, c.level])).toEqual([
      ["expiry", "good"],
      ["name", "good"],
      ["key", "good"],
      ["chain", "good"],
      ["old_tls", "good"],
    ]);
    expect(r.cipher).toBe("TLS_AES_128_GCM_SHA256");
  });

  it("explains expired, self-signed, mismatched and incomplete-chain certificates", async () => {
    const expired = await run({ host: "expired.example.com" }, deps());
    expect(byId(expired, "expiry")).toMatchObject({ level: "error", title: "Expired 30 days ago" });
    expect(expired.verdict).toEqual({ level: "error", text: "Expired 30 days ago." });
    const self = await run({ host: "selfsigned.example.com" }, deps());
    expect(byId(self, "chain")).toMatchObject({ level: "error", title: "The certificate is self-signed" });
    expect(byId(self, "lifetime")).toMatchObject({ level: "info" });
    expect(self.chain).toHaveLength(1);
    expect(byId(self, "tls13")).toMatchObject({ level: "info", title: "TLS 1.3 is not supported" });
    const mismatch = await run({ host: "mismatch.example.com" }, deps());
    expect(byId(mismatch, "name")).toMatchObject({ level: "error", title: "Does not cover mismatch.example.com" });
    expect(mismatch.verdict.text).toBe("Does not cover mismatch.example.com.");
    const incomplete = await run({ host: "incomplete.example.com" }, deps());
    expect(byId(incomplete, "chain")).toMatchObject({ level: "error", title: "The chain is incomplete" });
    expect(explainAuthError("SOMETHING_NEW")).toMatchObject({ kind: "other", detail: "The TLS library reported “SOMETHING_NEW”." });
  });

  it("counts down the days with warnings at 30, 14 and 7, and flags TLS 1.0/1.1 and weak keys", async () => {
    const legacy = await run({ host: "legacy.example.com" }, deps());
    expect(byId(legacy, "expiry")).toMatchObject({ level: "warning", title: "Expires in 10 days" });
    expect(byId(legacy, "old_tls")).toMatchObject({ level: "warning", title: "Accepts TLS 1.0 and TLS 1.1" });
    expect(byId(legacy, "key")).toMatchObject({ level: "error", title: "Weak key: RSA 1024 bits" });
    const at = (days: number) => run({ host: "shop.example.com" }, { tls: mockTls().tls, now: () => new Date(NOW.getTime() + (54 - days) * 86_400_000) });
    expect((await at(30)).checks[0]).toMatchObject({ level: "warning", title: "Expires in 30 days" });
    expect((await at(31)).checks[0]).toMatchObject({ level: "good" });
    expect((await at(14)).checks[0]).toMatchObject({ level: "warning", title: "Expires in 14 days" });
    expect((await at(7)).checks[0]).toMatchObject({ level: "error", title: "Expires in 7 days" });
    expect((await at(1)).checks[0].title).toBe("Expires in 1 day");
  });

  it("still reads the certificate when only an old protocol works, and explains connection failures", async () => {
    const old = await run({ host: "tls10only.example.com" }, deps());
    expect(old.versions.filter((v) => v.accepted).map((v) => v.version)).toEqual(["TLSv1"]);
    expect(byId(old, "old_tls")).toMatchObject({ title: "Accepts TLS 1.0" });
    await expect(run({ host: "closed.example.com" }, deps())).rejects.toMatchObject({ code: "network", message: "Could not connect: the name may not exist, or nothing answers on that port." });
    await expect(run({ host: "shop.example.com:21" }, deps())).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("validates the request and answers with the contract", async () => {
    const { POST } = await import("../src/api/route");
    const post = (body: unknown) => POST(new Request("http://localhost/api/tools/ssl-certificate-checker", { method: "POST", body: JSON.stringify(body) }));
    const r = await post({ host: "example.com", port: 25 });
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect((await post({ host: "" })).status).toBe(400);
  });

  it("passes the chosen port to every connection and lists the leaf's names and key details", async () => {
    const d = deps();
    const r = await run({ host: "shop.example.com", port: 8443 }, d);
    expect(new Set(d.calls.map((c) => c.port))).toEqual(new Set([8443]));
    expect(r.port).toBe(8443);
    expect(r.chain[0]).toMatchObject({ san: ["DNS:shop.example.com", "DNS:www.shop.example.com"], keyType: "ec", keyBits: 256, issuerName: "Let's Encrypt", daysLeft: 54 });
    expect(r.alpn).toBe("h2");
  });

  it("marks a version as untested (not refused) when its probe times out", async () => {
    const m = mockTls();
    const tls: typeof m.tls = async (host, opts = {}) => {
      if (opts.version === "TLSv1.1") throw Object.assign(new Error("timeout"), { code: "timeout" });
      return m.tls(host, opts);
    };
    const r = await run({ host: "shop.example.com" }, { tls, now: () => NOW });
    expect(r.versions.find((v) => v.version === "TLSv1.1")).toEqual({ version: "TLSv1.1", accepted: null, note: "no answer" });
    // TLS 1.0 refused, TLS 1.1 unknown: no "refused" claim is made.
    expect(r.checks.find((c) => c.id === "old_tls")).toBeUndefined();
  });
});
