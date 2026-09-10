"use server";

import { z } from "zod";
import { newsletterService } from "@/services/newsletter.service";

/**
 * Newsletter subscribe (spec §18, §88). Server-side validation always runs
 * regardless of client checks. Rate limiting + provider hand-off land in
 * Phase 8; today this persists intent via newsletterService.
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

  const res = await newsletterService.subscribe(parsed.data.email, "homepage");
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
