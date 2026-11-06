import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { include: ["src/**/*.test.ts", "src/**/*.test.tsx"], hookTimeout: 60_000, testTimeout: 30_000 },
});
