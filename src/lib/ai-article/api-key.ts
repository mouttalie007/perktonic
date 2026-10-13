import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * The Claude API key for the "API Articles" workflow.
 *
 * Stored in SiteSettings.anthropicApiKeyEnc, AES-256-GCM encrypted with a
 * key derived from AUTH_SECRET (an env var that only exists on the server),
 * so a database leak alone never yields a usable key. Resolution order:
 * the admin-saved key first (so it can be rotated from the settings page
 * with no server access), then the ANTHROPIC_API_KEY env var.
 *
 * Deliberately not marked "server-only" so scripts/tests under tsx can use
 * it; it is only ever imported from server actions and server components,
 * and the plaintext key is never returned to the browser (see maskKey).
 */

const SALT = "perktonic-anthropic-api-key-v1";

function derivedKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set, so the API key can't be encrypted or decrypted.");
  return scryptSync(secret, SALT, 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derivedKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string | null {
  try {
    const [v, iv, tag, ct] = stored.split(":");
    if (v !== "v1" || !iv || !tag || !ct) return null;
    const decipher = createDecipheriv("aes-256-gcm", derivedKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
  } catch {
    // Wrong AUTH_SECRET (rotated) or corrupt value -- treat as "not set".
    return null;
  }
}

/** First 7 and last 4 characters only -- enough to recognise a key, never to use it. */
export function maskKey(key: string): string {
  if (key.length <= 14) return "••••";
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

export type ApiKeySource = "settings" | "env" | "none";

export async function getAnthropicApiKey(): Promise<{ key: string | null; source: ApiKeySource }> {
  const row = await prisma.siteSettings.findUnique({
    where: { id: "singleton" },
    select: { anthropicApiKeyEnc: true },
  });
  if (row?.anthropicApiKeyEnc) {
    const key = decryptSecret(row.anthropicApiKeyEnc);
    if (key) return { key, source: "settings" };
  }
  const envKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (envKey) return { key: envKey, source: "env" };
  return { key: null, source: "none" };
}

export async function saveAnthropicApiKey(plain: string): Promise<void> {
  const enc = encryptSecret(plain.trim());
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: { anthropicApiKeyEnc: enc },
    create: { id: "singleton", anthropicApiKeyEnc: enc },
  });
}

export async function clearAnthropicApiKey(): Promise<void> {
  await prisma.siteSettings.updateMany({ where: { id: "singleton" }, data: { anthropicApiKeyEnc: null } });
}

export interface KeyStatus {
  configured: boolean;
  source: ApiKeySource;
  masked: string | null;
  model: string;
}

/** Safe to show an admin: the masked key and where it came from, never the key. */
export async function getKeyStatus(model: string): Promise<KeyStatus> {
  const { key, source } = await getAnthropicApiKey();
  return { configured: Boolean(key), source, masked: key ? maskKey(key) : null, model };
}
