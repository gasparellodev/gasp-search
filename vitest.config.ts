import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", "tests/e2e/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      // Apenas o que é testado por unit/integration. Pages e layouts são
      // cobertos por E2E (Playwright). Shadcn primitives (components/ui)
      // são gerados pelo CLI e não devem ser unit-tested.
      include: [
        "lib/**/*.{ts,tsx}",
        "app/api/**/*.{ts,tsx}",
        "components/layout/**/*.{ts,tsx}",
        "components/search/**/*.{ts,tsx}",
        "components/leads/**/*.{ts,tsx}",
        "components/pipeline/**/*.{ts,tsx}",
        "components/ai/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.d.ts",
        "**/*.config.*",
        "**/node_modules/**",
        "**/.next/**",
        "**/coverage/**",
        "**/playwright-report/**",
        "**/CLAUDE.md",
        "tests/**",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
