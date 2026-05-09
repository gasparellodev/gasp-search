import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "@/lib/sites/stock-photos.manifest.json";
import { stockManifestSchema } from "@/lib/sites/stock-photos.schema";

/**
 * AC3 — cada `url` do manifest mapeia pra um arquivo legível em
 * `public/<url>`. Falha CI se o manifest aponta pra arquivo inexistente
 * (URL fantasma → 404 em produção).
 */
describe("stock-photos manifest filesystem coverage", () => {
  const parsed = stockManifestSchema.parse(manifest);
  const projectRoot = process.cwd();

  for (const car of parsed.cars) {
    it(`AC3 — arquivo existe e é legível para id="${car.id}" (${car.url})`, () => {
      const filePath = path.join(projectRoot, "public", car.url);
      expect(() => accessSync(filePath, constants.R_OK)).not.toThrow();
      const stat = statSync(filePath);
      expect(stat.isFile()).toBe(true);
      expect(stat.size).toBeGreaterThan(0);
    });
  }

  it("AC3 — total de arquivos no manifest == 14", () => {
    expect(parsed.cars).toHaveLength(14);
  });
});
