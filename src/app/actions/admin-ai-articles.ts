"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";
import { AI_MODEL } from "@/lib/ai-article/generate";
import { enqueueBriefs, stopQueue } from "@/lib/ai-article/queue";
import {
  getChatPromptForBrief,
  importPastedArticle,
  type ImportResult,
} from "@/lib/ai-article/generate";
import { saveQuizAction, type SaveQuizResult } from "@/app/actions/admin-quiz";
import {
  attachSlotImage,
  publishBrief,
  type AttachResult,
  type PublishResult,
} from "@/lib/ai-article/images";
import { getBriefViews, type BriefView } from "@/lib/ai-article/views";
import { asSlots, type ImageSlot } from "@/lib/ai-article/slots";
import {
  clearAnthropicApiKey,
  getAnthropicApiKey,
  getKeyStatus,
  saveAnthropicApiKey,
  type KeyStatus,
} from "@/lib/ai-article/api-key";

/** Polled by the board every few seconds. */
export async function getBriefViewsAction(): Promise<BriefView[]> {
  await requireUser("EDITOR");
  return getBriefViews();
}

export async function saveBriefNotesAction(
  briefId: string,
  notes: string,
): Promise<void> {
  await requireUser("EDITOR");
  await prisma.articleBrief.updateMany({
    where: { id: briefId, status: { in: ["PENDING", "FAILED", "DRAFTED"] } },
    data: { notes: notes.trim() || null },
  });
}

/** Starts the Claude run(s) in the background and returns immediately. */
export async function generateBriefsAction(
  briefIds: string[],
): Promise<{ queued: number }> {
  await requireUser("EDITOR");
  const queued = await enqueueBriefs(briefIds.slice(0, 50));
  revalidatePath("/adminiyad/ai-articles");
  return { queued };
}

/** Emergency stop for the API queue: aborts the request in flight and un-queues the rest. */
export async function stopGenerationAction(): Promise<void> {
  await requireUser("EDITOR");
  await stopQueue();
  revalidatePath("/adminiyad/ai-articles");
}

// --- Copy-and-paste workflow (claude.ai; no API cost) -----------------------

/** The prompt to paste into claude.ai for this article (also saves the first-hand notes, if given). */
export async function getChatPromptAction(
  briefId: string,
  notes?: string,
): Promise<string | null> {
  await requireUser("EDITOR");
  return getChatPromptForBrief(briefId, notes);
}

/** Claude's pasted reply becomes the DRAFT article (replacing an earlier draft of the same brief). */
export async function importPastedArticleAction(
  briefId: string,
  raw: string,
): Promise<ImportResult> {
  await requireUser("EDITOR");
  const res = await importPastedArticle(briefId, raw);
  if (res.ok) revalidatePath("/adminiyad/ai-articles");
  return res;
}

/** Claude's pasted quiz for a PUBLISHED article (same save as the article editor's Quiz box). */
export async function saveBriefQuizAction(
  briefId: string,
  raw: string,
): Promise<SaveQuizResult> {
  await requireUser("EDITOR");
  const brief = await prisma.articleBrief.findUnique({
    where: { id: briefId },
    select: { articleId: true, status: true },
  });
  if (!brief?.articleId || brief.status !== "PUBLISHED") {
    return {
      ok: false,
      error:
        "Publish the article first: the quiz is made from the live article.",
    };
  }
  const res = await saveQuizAction(brief.articleId, raw);
  if (res.ok) revalidatePath("/adminiyad/ai-articles");
  return res;
}

export interface WizardData {
  title: string;
  slots: ImageSlot[];
}

export async function getWizardDataAction(
  briefId: string,
): Promise<WizardData | null> {
  await requireUser("EDITOR");
  const brief = await prisma.articleBrief.findUnique({
    where: { id: briefId },
  });
  if (!brief || brief.status !== "DRAFTED") return null;
  return { title: brief.title, slots: asSlots(brief.imageSlots) };
}

/** One pasted image for one slot of the images popup. */
export async function attachSlotImageAction(
  briefId: string,
  slotIndex: number,
  formData: FormData,
): Promise<AttachResult> {
  await requireUser("EDITOR");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No image found on the clipboard." };
  }
  return attachSlotImage(briefId, slotIndex, file);
}

export async function publishBriefAction(
  briefId: string,
  publishedAtLocal: string,
): Promise<PublishResult> {
  await requireUser("EDITOR");
  const parsed = publishedAtLocal ? new Date(publishedAtLocal) : new Date();
  const publishedAt = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return publishBrief(briefId, publishedAt);
}

// ---------------------------------------------------------------------------
// Settings: the Claude API key (ADMIN only; the key itself never leaves the server)
// ---------------------------------------------------------------------------

export async function getKeyStatusAction(): Promise<KeyStatus> {
  await requireUser("EDITOR");
  return getKeyStatus(AI_MODEL);
}

export type KeyActionResult =
  { ok: true; message: string } | { ok: false; error: string };

export async function saveApiKeyAction(
  formData: FormData,
): Promise<KeyActionResult> {
  await requireUser("ADMIN");
  const key = String(formData.get("apiKey") ?? "").trim();
  if (!key.startsWith("sk-ant-") || key.length < 30 || /\s/.test(key)) {
    return {
      ok: false,
      error:
        "That doesn't look like a Claude API key (it should start with sk-ant-).",
    };
  }
  try {
    await saveAnthropicApiKey(key);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't save the key.",
    };
  }
  revalidatePath("/adminiyad/settings/ai");
  revalidatePath("/adminiyad/ai-articles");
  return { ok: true, message: "Key saved (encrypted)." };
}

export async function clearApiKeyAction(): Promise<KeyActionResult> {
  await requireUser("ADMIN");
  await clearAnthropicApiKey();
  revalidatePath("/adminiyad/settings/ai");
  revalidatePath("/adminiyad/ai-articles");
  return { ok: true, message: "Saved key removed." };
}

/** Free check: looks the model up with the key; no tokens are spent. */
export async function testApiKeyAction(): Promise<KeyActionResult> {
  await requireUser("ADMIN");
  const { key } = await getAnthropicApiKey();
  if (!key) return { ok: false, error: "No key is configured yet." };
  try {
    const client = new Anthropic({
      apiKey: key,
      maxRetries: 1,
      timeout: 20_000,
    });
    const model = await client.models.retrieve(AI_MODEL);
    return {
      ok: true,
      message: `Key works. ${model.display_name ?? AI_MODEL} is available.`,
    };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError)
      return {
        ok: false,
        error: "Claude rejected this key (authentication failed).",
      };
    if (e instanceof Anthropic.PermissionDeniedError)
      return { ok: false, error: "This key isn't allowed to use that model." };
    if (e instanceof Anthropic.APIError)
      return {
        ok: false,
        error: `Claude API error ${e.status ?? ""}: ${e.message}`.slice(0, 300),
      };
    return { ok: false, error: "Couldn't reach the Claude API." };
  }
}
