import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/ai/**",
        "src/lib/rate-limit.ts",
        "src/lib/api/**",
        "src/lib/health.ts",
        "src/lib/markdown-export.ts",
        "src/lib/safe-url.ts",
        "src/lib/image-utils.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        // Persist/orchestration glue is covered via focused unit tests elsewhere;
        // keep the coverage gate on pure helpers + router/prompts/rate-limit.
        "src/lib/ai/text-generation.ts",
      ],
      reporter: ["text", "lcov"],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
