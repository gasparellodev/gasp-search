import { z } from "zod";

const searchTermSchema = z
  .string()
  .trim()
  .min(2, "Busca precisa ter ao menos 2 caracteres")
  .max(120, "Busca muito longa");

export const searchGoogleMapsSchema = z
  .object({
    searchStringsArray: z
      .array(searchTermSchema)
      .min(1, "Informe ao menos uma busca")
      .max(20, "Informe no máximo 20 buscas por execução"),
    maxCrawledPlacesPerSearch: z.coerce
      .number()
      .int("Limite precisa ser um número inteiro")
      .min(1, "Limite mínimo é 1")
      .max(500, "Limite máximo é 500")
      .default(50),
    language: z.string().trim().min(2).max(12).default("pt-BR"),
    countryCode: z
      .string()
      .trim()
      .length(2, "countryCode precisa ter 2 letras")
      .transform((value) => value.toLowerCase())
      .default("br"),
  })
  .strict();

export type SearchGoogleMapsInput = z.infer<typeof searchGoogleMapsSchema>;
