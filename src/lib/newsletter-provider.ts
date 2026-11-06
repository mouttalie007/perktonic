/**
 * Newsletter provider adapter (MailerLite). The subscriber is stored in our own table first; this sends the
 * address to the provider, which runs the double opt-in e-mail (the account setting "Double opt-in") and the
 * campaigns. Pure `fetch` so it can be tested with a stub. Docs: https://developers.mailerlite.com/docs/subscribers.html
 */

export interface ProviderConfig {
  provider: string;
  apiKey: string;
  groupId: string;
}

const BASE = "https://connect.mailerlite.com/api";

export function providerEnabled(c: ProviderConfig): boolean {
  return c.provider.toLowerCase() === "mailerlite" && c.apiKey.length > 10;
}

type Fetch = typeof fetch;

async function call(c: ProviderConfig, body: Record<string, unknown>, f: Fetch): Promise<boolean> {
  const res = await f(`${BASE}/subscribers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok; // 200 = updated, 201 = created
}

/** Adds (or re-activates) a subscriber; with double opt-in on, the provider sends the confirmation e-mail. */
export function providerSubscribe(c: ProviderConfig, email: string, f: Fetch = fetch): Promise<boolean> {
  return call(c, { email, ...(c.groupId ? { groups: [c.groupId] } : {}) }, f);
}

/** Marks the subscriber as unsubscribed at the provider. */
export function providerUnsubscribe(c: ProviderConfig, email: string, f: Fetch = fetch): Promise<boolean> {
  return call(c, { email, status: "unsubscribed" }, f);
}
