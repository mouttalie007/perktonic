import { prisma } from "@/lib/prisma";
import { serverEnv } from "@/config/env.server";
import { providerEnabled, providerSubscribe, providerUnsubscribe, type ProviderConfig } from "@/lib/newsletter-provider";

/**
 * Newsletter subscription abstraction (spec §18, §88, §89).
 * The address is always stored in our own table. When NEWSLETTER_PROVIDER=mailerlite and a key are set it is
 * also sent to the provider, which sends the confirmation (double opt-in) e-mail and the campaigns. Subscriber emails are never exposed publicly.
 */

export type SubscribeResult =
  | { ok: true; status: "pending" | "subscribed" }
  | { ok: false; reason: "invalid-email" | "error" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const config = (): ProviderConfig => ({
  provider: serverEnv.NEWSLETTER_PROVIDER,
  apiKey: serverEnv.NEWSLETTER_API_KEY,
  groupId: serverEnv.NEWSLETTER_LIST_ID,
});

export const newsletterService = {
  get provider(): string {
    return serverEnv.NEWSLETTER_PROVIDER;
  },

  /** True when subscribers are sent to a provider that confirms them by e-mail. */
  get confirmsByEmail(): boolean {
    return providerEnabled(config());
  },

  async subscribe(
    emailRaw: string,
    source = "site",
  ): Promise<SubscribeResult> {
    const email = emailRaw.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return { ok: false, reason: "invalid-email" };

    try {
      const row = await prisma.newsletterSubscriber.upsert({
        where: { email },
        update: { status: "pending", source },
        create: { email, source, status: "pending" },
      });
      if (providerEnabled(config()) && !(await providerSubscribe(config(), email))) {
        return { ok: false, reason: "error" };
      }
      return { ok: true, status: row.status as "pending" | "subscribed" };
    } catch {
      return { ok: false, reason: "error" };
    }
  },

  async unsubscribe(emailRaw: string): Promise<{ ok: boolean }> {
    const email = emailRaw.trim().toLowerCase();
    try {
      await prisma.newsletterSubscriber.update({
        where: { email },
        data: { status: "unsubscribed", unsubscribedAt: new Date() },
      });
      if (providerEnabled(config())) await providerUnsubscribe(config(), email).catch(() => false);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  },
};
