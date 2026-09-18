import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    // Database integration tests share one database; run files sequentially.
    fileParallelism: false,
    hookTimeout: 120000,
    testTimeout: 30000,
  },
});
