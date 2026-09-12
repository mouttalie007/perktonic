"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { commentService } from "@/services/comment.service";
import { createRateLimiter } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/client-ip";

const schema = z.object({
  articleId: z.string().min(1),
  path: z.string().min(1), // to revalidate after a successful submit
  name: z.string().trim().min(1, "Enter your name.").max(80),
  body: z.string().trim().min(3, "Comment is too short.").max(2000),
  company: z.string().max(0).optional(), // honeypot
});

export type CommentFormState = { status: "idle" | "error" | "success"; message?: string };

const limiter = createRateLimiter(5, 15 * 60_000);

export async function submitComment(
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const parsed = schema.safeParse({
    articleId: formData.get("articleId"),
    path: formData.get("path"),
    name: formData.get("name"),
    body: formData.get("body"),
    company: formData.get("company") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const ip = hashIp(await getClientIp());
  if (limiter.isLimited(ip)) {
    return { status: "error", message: "Too many comments sent. Please try again later." };
  }
  limiter.record(ip);

  await commentService.create({
    articleId: parsed.data.articleId,
    name: parsed.data.name,
    body: parsed.data.body,
    ipHash: ip,
  });
  revalidatePath(parsed.data.path);

  return {
    status: "success",
    message: "Thanks — your comment is awaiting moderation and will appear once approved.",
  };
}
