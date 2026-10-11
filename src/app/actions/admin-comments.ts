"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/require-admin";
import { commentService } from "@/services/comment.service";
import type { CommentStatus } from "@prisma/client";

export async function setCommentStatus(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as CommentStatus;
  // Fetch the public path(s) before the write — a delete/status-flip
  // wouldn't change them, but doing it first keeps the two calls simple to
  // reason about (no risk of racing the comment being gone by the time we
  // look up which article it belonged to).
  const paths = await commentService.publicPathsFor(id);
  await commentService.setStatus(id, status);
  revalidatePath("/adminiyad/comments");
  // The story page is statically generated — approving/un-approving a
  // comment there does nothing publicly until its cache is invalidated.
  for (const p of paths) revalidatePath(p);
}

export async function deleteComment(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  const paths = await commentService.publicPathsFor(id);
  await commentService.remove(id);
  revalidatePath("/adminiyad/comments");
  for (const p of paths) revalidatePath(p);
}
