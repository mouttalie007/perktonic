import { describe, expect, it } from "vitest";
import { checkUrl, isBlockedAddress, safeFetch, SafeFetchError } from "./safe-fetch";
import { hit, resetRateLimits } from "./rate-limit";

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1",
    "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1",
    "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "2001:db8::1", "2002:7f00:1::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "64:ff9b::7f00:1", "[::1]", "not-an-ip",
  ])("blocks %s", (a) => expect(isBlockedAddress(a)).toBe(true));

  it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34", "185.216.75.76", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "allows %s",
    (a) => expect(isBlockedAddress(a)).toBe(false),
  );
});

describe("checkUrl", () => {
  const code = (u: string) => {
    try {
      checkUrl(u);
      return "ok";
    } catch (e) {
      return (e as SafeFetchError).code;
    }
  };
  it("accepts ordinary URLs", () => {
    expect(code("https://example.com/a?b=1")).toBe("ok");
    expect(code("http://example.com:80/")).toBe("ok");
    expect(code("https://example.com:443/")).toBe("ok");
  });
  it("rejects bad syntax, schemes and credentials", () => {
    expect(code("not a url")).toBe("invalid_url");
    expect(code("ftp://example.com/")).toBe("invalid_url");
    expect(code("file:///etc/passwd")).toBe("invalid_url");
    expect(code("javascript:alert(1)")).toBe("invalid_url");
    expect(code("https://user:pw@example.com/")).toBe("invalid_url");
    expect(code("https://example.com/" + "a".repeat(2100))).toBe("invalid_url");
  });
  it("rejects private hosts in every spelling", () => {
    for (const u of [
      "http://localhost/", "http://foo.localhost/", "http://printer.local/", "http://db.internal/",
      "http://127.0.0.1/", "http://2130706433/", "http://0x7f.1/", "http://127.1/", "http://[::1]/",
      "http://169.254.169.254/latest/meta-data/", "http://10.0.0.5/", "http://[::ffff:127.0.0.1]/", "http://0/",
    ]) {
      expect(code(u), u).toBe("blocked_host");
    }
  });
  it("rejects non-web ports", () => {
    expect(code("http://example.com:22/")).toBe("blocked_host");
    expect(code("https://example.com:8443/")).toBe("blocked_host");
  });
});

describe("safeFetch", () => {
  it("refuses a private target without opening a connection", async () => {
    await expect(safeFetch("http://127.0.0.1/")).rejects.toMatchObject({ code: "blocked_host" });
    await expect(safeFetch("http://localhost/")).rejects.toMatchObject({ code: "blocked_host" });
  });
});

describe("rateLimit", () => {
  it("counts per bucket and ip, then recovers after the window", () => {
    resetRateLimits();
    const cfg = { bucket: "t", limit: 3, windowSec: 60 };
    const t0 = 1_000_000;
    expect([1, 2, 3].map(() => hit("1.1.1.1", cfg, t0).ok)).toEqual([true, true, true]);
    const blocked = hit("1.1.1.1", cfg, t0 + 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(59);
    expect(hit("2.2.2.2", cfg, t0).ok).toBe(true);
    expect(hit("1.1.1.1", { ...cfg, bucket: "other" }, t0).ok).toBe(true);
    expect(hit("1.1.1.1", cfg, t0 + 61_000).ok).toBe(true);
  });
});
