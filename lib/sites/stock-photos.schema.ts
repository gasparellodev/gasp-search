import { z } from "zod";

/**
 * Categorias de carros suportadas pelo banco de stock photos V1.
 * Reflete o leque básico de uma concessionária multimarcas
 * (sedan, SUV, picape, hatch, esportivo). Jet ski / motos NÃO entram —
 * `business_type: 'concessionaria'` é o único cliente do helper na V1.
 */
export const stockCarCategoryEnum = z.enum([
  "sedan",
  "suv",
  "picape",
  "hatch",
  "esportivo",
]);

/** Estado do veículo. V1 só usa `0km` (todos os assets são placeholders novos). */
export const stockCarConditionEnum = z.enum(["0km", "seminovo"]);

/**
 * Schema Zod do manifest co-localizado em `lib/sites/stock-photos.manifest.json`.
 *
 * Validação executada no boot (top-level `parse` em `stock-photos.ts`) — qualquer
 * desvio de shape estoura o startup do servidor antes de causar 500 silencioso
 * em runtime. Defesa em profundidade contra edição manual incorreta do manifest.
 *
 * URL é estritamente `/assets/stock/<file>.png` na V1: pega typo silencioso
 * (ex: `assets/stock/m2.png` sem barra → Next.js trata como rota relativa
 * quebrada). Em V2 quando assets migrarem pra `/sites/stock/cars/`, é troca
 * de uma linha aqui.
 */
export const stockManifestSchema = z.object({
  version: z.string(),
  cars: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]+$/, {
          message:
            "id deve conter apenas minúsculas, dígitos e hífens (kebab-case)",
        }),
        category: stockCarCategoryEnum,
        condition: stockCarConditionEnum,
        color: z.string().optional(),
        url: z
          .string()
          .startsWith("/assets/stock/", {
            message: "url deve começar com /assets/stock/",
          })
          .endsWith(".png", { message: "url deve terminar com .png" }),
        alt: z.string().min(1, { message: "alt não pode ser vazio" }),
      }),
    )
    .min(1, { message: "manifest precisa ter ao menos 1 carro" }),
});

export type StockManifest = z.infer<typeof stockManifestSchema>;
export type StockCarEntry = StockManifest["cars"][number];
export type StockCarCategory = z.infer<typeof stockCarCategoryEnum>;
export type StockCarCondition = z.infer<typeof stockCarConditionEnum>;
