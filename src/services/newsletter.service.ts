import { prisma } from "@/lib/prisma";
import { serverEnv } from "@/config/env";

/**
 * Newsletter subscription abstraction (spec §18, §88, §89).
 * Phase 0: persists intent to our own table only. A provider adapter
 * (Mailchimp / Buttondown / ...) is plugged in at Phase 8 behind this same
 * interface. Subscriber emails are never exposed publicly.
 */

export type SubscribeResult =
  | { ok: true; status: "pending" | "subscribed" }
  | { ok: false; reason: "invalid-email" | "error" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const newsletterService = {
  get provider(): string {
    return serverEnv.NEWSLETTER_PROVIDER;
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
      // TODO(Phase 8): forward to configured provider when this.provider is set.
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
      return { ok: true };
    } catch {
      return { ok: false };
    }
  },
};
