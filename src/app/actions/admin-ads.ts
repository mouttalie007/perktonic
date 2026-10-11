"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";

const unitSchema = z.object({
  name: z.string().trim().min(1),
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/),
  code: z.string().trim().min(1, "Paste the ad network's snippet."),
  format: z.string().trim().optional(),
  enabled: z.coerce.boolean().optional(),
  showDesktop: z.coerce.boolean().optional(),
  showTablet: z.coerce.boolean().optional(),
  showMobile: z.coerce.boolean().optional(),
  reservedHeightDesktop: z.string().optional(),
  reservedHeightMobile: z.string().optional(),
});

function parseUnit(formData: FormData) {
  const v = unitSchema.parse({
    name: formData.get("name"),
    key: formData.get("key"),
    code: formData.get("code"),
    format: formData.get("format") || undefined,
    enabled: formData.get("enabled") === "on",
    showDesktop: formData.get("showDesktop") === "on",
    showTablet: formData.get("showTablet") === "on",
    showMobile: formData.get("showMobile") === "on",
    reservedHeightDesktop: formData.get("reservedHeightDesktop") || undefined,
    reservedHeightMobile: formData.get("reservedHeightMobile") || undefined,
  });
  return {
    ...v,
    reservedHeightDesktop: v.reservedHeightDesktop ? Number(v.reservedHeightDesktop) : null,
    reservedHeightMobile: v.reservedHeightMobile ? Number(v.reservedHeightMobile) : null,
  };
}

export async function createAdUnit(formData: FormData) {
  await requireUser("EDITOR");
  await prisma.adUnit.create({ data: parseUnit(formData) });
  revalidatePath("/adminiyad/ads/units");
  revalidatePath("/adminiyad/ads/placements");
  redirect("/adminiyad/ads/units" as Route);
}

export async function updateAdUnit(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  await prisma.adUnit.update({ where: { id }, data: parseUnit(formData) });
  revalidatePath("/adminiyad/ads/units");
  revalidatePath("/adminiyad/ads/placements");
  redirect("/adminiyad/ads/units" as Route);
}

export async function deleteAdUnit(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  await prisma.adPlacement.updateMany({ where: { adUnitId: id }, data: { adUnitId: null } });
  await prisma.adUnit.delete({ where: { id } });
  revalidatePath("/adminiyad/ads/units");
  revalidatePath("/adminiyad/ads/placements");
}

const placementSchema = z.object({
  adUnitId: z.string().trim().optional(),
  enabled: z.coerce.boolean().optional(),
  autoInject: z.coerce.boolean().optional(),
  everyNParagraphs: z.string().optional(),
  maxInjections: z.string().optional(),
});

export async function updateAdPlacement(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  const v = placementSchema.parse({
    adUnitId: formData.get("adUnitId") || undefined,
    enabled: formData.get("enabled") === "on",
    autoInject: formData.get("autoInject") === "on",
    everyNParagraphs: formData.get("everyNParagraphs") || undefined,
    maxInjections: formData.get("maxInjections") || undefined,
  });
  await prisma.adPlacement.update({
    where: { id },
    data: {
      adUnitId: v.adUnitId || null,
      enabled: v.enabled ?? false,
      autoInject: v.autoInject ?? false,
      everyNParagraphs: v.everyNParagraphs ? Number(v.everyNParagraphs) : null,
      maxInjections: v.maxInjections ? Number(v.maxInjections) : null,
    },
  });
  revalidatePath("/adminiyad/ads/placements");
}
