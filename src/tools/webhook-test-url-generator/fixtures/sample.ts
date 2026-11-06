// The demo state the page opens with: a pre-filled endpoint and three example requests. Nothing is
// created on the server until the visitor presses "Create URL".
import { buildCapture } from "../src/logic/capture";
import type { EndpointView } from "../src/types";

const ID = "demo00000000000000000A";
const base = `https://perktonic.com/api/tools/webhook-test-url-generator/hook/${ID}`;
const enc = (s: string) => new TextEncoder().encode(s);

const order = JSON.stringify({ id: "evt_1Q9ZK2", type: "order.paid", created: 1793611200, data: { order_id: "A-10442", amount: 4990, currency: "eur", customer: { email: "test@example.com" } } });
const form = "name=Ada+Lovelace&email=ada%40example.com&plan=pro&newsletter=yes";

export const SAMPLE_ENDPOINT: EndpointView = {
  id: ID,
  createdAt: "2026-11-03T09:00:00.000Z",
  expiresAt: "2026-11-03T10:00:00.000Z",
  extensionsLeft: 3,
  reply: { status: 200, contentType: "text/plain", body: "ok", delayMs: 0 },
  requests: [
    buildCapture({ method: "GET", url: `${base}?status=ok&job=nightly-backup&duration=742`, headers: [["user-agent", "curl/8.10.1"], ["accept", "*/*"], ["x-forwarded-for", "198.51.100.23"]], body: new Uint8Array(0), truncated: false, size: 0 }, "demoreq3", new Date("2026-11-03T09:14:05.000Z")),
    buildCapture({ method: "POST", url: `${base}?form=signup`, headers: [["content-type", "application/x-www-form-urlencoded"], ["user-agent", "FormRelay/3.2"], ["x-forwarded-for", "192.0.2.77"]], body: enc(form), truncated: false, size: form.length }, "demoreq2", new Date("2026-11-03T09:12:41.000Z")),
    buildCapture({ method: "POST", url: base, headers: [["content-type", "application/json"], ["user-agent", "ShopHooks/1.0 (+https://example.com/hooks)"], ["x-shop-signature", "t=1793611200,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd"], ["x-forwarded-for", "203.0.113.41"]], body: enc(order), truncated: false, size: order.length }, "demoreq1", new Date("2026-11-03T09:10:02.000Z")),
  ],
};

export const SAMPLE_URL = base;
