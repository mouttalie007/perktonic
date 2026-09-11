"use server";

import { z } from "zod";
import { newsletterService } from "@/services/newsletter.service";
import { createRateLimiter } from "@/lib/rate-limit";

/**
 * Newsletter subscribe/unsubscribe (spec §18, §88, §89). Server-side
 * validation always runs regardless of client checks; a honeypot field and a
 * per-email rate limit guard the subscribe form against abuse.
 */

const schema = z.object({
  email: z.string().trim().email(),
  // Honeypot — bots fill hidden fields; humans leave them blank.
  company: z.string().max(0).optional(),
});

export type NewsletterState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const limiter = createRateLimiter(5, 60 * 60_000);

export async function subscribeAction(
  _prev: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    company: formData.get("company") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please enter a valid email address.",
    };
  }

  if (limiter.isLimited(parsed.data.email)) {
    return { status: "error", message: "Please try again in a little while." };
  }
  limiter.record(parsed.data.email);

  const source = String(formData.get("source") || "homepage");
  const res = await newsletterService.subscribe(parsed.data.email, source);
  if (!res.ok) {
    return {
      status: "error",
      message:
        res.reason === "invalid-email"
          ? "Please enter a valid email address."
          : "Something went wrong. Please try again in a moment.",
    };
  }

  return {
    status: "success",
    message: "You're on the list. Watch your inbox for the good stuff.",
  };
}

export type UnsubscribeState = { status: "idle" | "success" | "error"; message?: string };

export async function unsubscribeAction(
  _prev: UnsubscribeState,
  formData: FormData,
): Promise<UnsubscribeState> {
  const parsed = z.string().trim().email().safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: "Please enter a valid email address." };
  }
  const res = await newsletterService.unsubscribe(parsed.data);
  return res.ok
    ? { status: "success", message: "You have been unsubscribed. Sorry to see you go." }
    : { status: "error", message: "We couldn't find that email address on our list." };
}
