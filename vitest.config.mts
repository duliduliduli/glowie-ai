import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globalSetup: "./tests/global-setup.ts",
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/glowie_test" },
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/empty.ts"),
    },
  },
});
