"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createRateLimiter } from "@/lib/rate-limit";

/**
 * Contact form (spec §22). Server-side validation always runs regardless of
 * client checks; a honeypot field and a per-email rate limit guard against
 * spam. No outbound email provider is configured yet, so messages are
 * stored for an editor to read in the admin (Contact Messages).
 */

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  subject: z.string().trim().min(1, "Enter a subject.").max(150),
  message: z.string().trim().min(10, "Message is too short.").max(5000),
  company: z.string().max(0).optional(), // honeypot
});

const limiter = createRateLimiter(3, 60 * 60_000);

export type ContactFormState = { status: "idle" | "error" | "success"; message?: string };

export async function submitContactForm(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    company: formData.get("company") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const { email } = parsed.data;
  if (limiter.isLimited(email)) {
    return { status: "error", message: "Too many messages sent. Please try again later." };
  }
  limiter.record(email);

  await prisma.contactMessage.create({
    data: {
      name: parsed.data.name,
      email,
      subject: parsed.data.subject,
      message: parsed.data.message,
    },
  });

  return {
    status: "success",
    message: "Thanks — your message has been sent. We read every one and reply when we can.",
  };
}
