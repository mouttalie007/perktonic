import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 * In dev, Next.js clears the module cache on HMR which would otherwise spawn
 * a new pool on every reload — so we cache the instance on `globalThis`.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
