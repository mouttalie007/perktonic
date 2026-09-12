"use server";

import { z } from "zod";
import { reactionService } from "@/services/reaction.service";
import { createRateLimiter } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/client-ip";

const schema = z.object({
  articleId: z.string().min(1),
  emoji: z.enum(["LAUGH", "LOVE", "WOW", "ANGRY", "SAD"]),
});

// Client-side localStorage already stops a casual double-click; this backs
// it up server-side against a script hammering the action directly. Keyed
// per IP+article+emoji so reacting to ten different stories isn't throttled
// by reacting once to the first one.
const limiter = createRateLimiter(1, 60_000);

export async function reactToArticle(
  articleId: string,
  emoji: string,
): Promise<{ ok: boolean }> {
  const parsed = schema.safeParse({ articleId, emoji });
  if (!parsed.success) return { ok: false };

  const ip = hashIp(await getClientIp());
  const key = `${ip}:${parsed.data.articleId}:${parsed.data.emoji}`;
  if (limiter.isLimited(key)) return { ok: false };
  limiter.record(key);

  await reactionService.react(parsed.data.articleId, parsed.data.emoji);
  return { ok: true };
}
