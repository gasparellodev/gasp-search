/**
 * Grep guard anti-regressão (issue #200 §5.4).
 *
 * Falha se aparecer string `wa.me/` hardcoded em qualquer arquivo de
 * produção (`app/`, `components/`, `lib/`) **fora** de `lib/whatsapp.ts`
 * (a única fonte canônica). Defesa contra:
 *   - Anti-pattern do mercado BR: button WhatsApp com `javascript:void(0)`
 *     ou string concat ad-hoc (caso visto na pesquisa de pme-seminovos-br).
 *   - PRs futuros que esqueçam do builder.
 *
 * O regex permite menções em comentários JSDoc apenas se referenciarem
 * `buildWhatsAppLink` (não link literal).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");

const DIRS_TO_SCAN = ["app", "components", "lib"] as const;
const ALLOWED_FILES = new Set([
  // Fonte canônica do builder.
  path.join(ROOT, "lib", "whatsapp.ts"),
]);

const HARDCODE_REGEX = /https?:\/\/wa\.me\//;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "coverage") {
      continue;
    }
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, files);
    } else if (
      stat.isFile() &&
      (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
      !entry.endsWith(".d.ts")
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("whatsapp grep guard", () => {
  it("zero wa.me/ hardcoded fora de lib/whatsapp.ts", () => {
    const violations: string[] = [];

    for (const subdir of DIRS_TO_SCAN) {
      const dirPath = path.join(ROOT, subdir);
      try {
        statSync(dirPath);
      } catch {
        continue;
      }

      for (const file of walk(dirPath)) {
        if (ALLOWED_FILES.has(file)) continue;

        const content = readFileSync(file, "utf-8");
        if (HARDCODE_REGEX.test(content)) {
          // Apresenta o caminho relativo pra mensagem de erro útil.
          const rel = path.relative(ROOT, file);
          // Coleta linhas com a violação (max 3 por arquivo, evita output ruído).
          const offendingLines = content
            .split("\n")
            .map((line, idx) => ({ line, n: idx + 1 }))
            .filter(({ line }) => HARDCODE_REGEX.test(line))
            .slice(0, 3)
            .map(({ line, n }) => `  ${rel}:${n}  ${line.trim()}`);

          violations.push(...offendingLines);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `\nHardcoded wa.me/ encontrado fora de lib/whatsapp.ts:\n${violations.join("\n")}\n\n` +
          `Use buildWhatsAppLink(...) ao invés de string concat. Veja lib/whatsapp.ts.`,
      );
    }

    expect(violations).toEqual([]);
  });
});
