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
      // `server-only` lança em qualquer ambiente cliente. Em testes
      // unitários (jsdom) tratamos como no-op — confiamos na convenção +
      // build do Next para enforcement real em prod.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
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
        "app/actions/**/*.{ts,tsx}",
        // Rotas públicas do Site Generator (Phase 7 — issue #160 em diante).
        // Têm lógica server-side (status routing, Zod safeParse, cache
        // helpers) que precisa de unit coverage além do E2E #166.
        "app/sites/**/*.{ts,tsx}",
        "components/layout/**/*.{ts,tsx}",
        "components/search/**/*.{ts,tsx}",
        "components/leads/**/*.{ts,tsx}",
        "components/pipeline/**/*.{ts,tsx}",
        "components/ai/**/*.{ts,tsx}",
        "components/sites/**/*.{ts,tsx}",
        // Schemas de domínio em `types/` que carregam lógica de validação
        // runtime (não-só type aliases) entram no coverage. Type-only files
        // como `database.ts` ficam de fora.
        "types/lead-site.ts",
        "types/visual-identity.ts",
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
