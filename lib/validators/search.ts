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

export const searchFormSchema = z
  .object({
    terms: z
      .array(searchTermSchema)
      .min(1, "Adicione ao menos um termo de busca")
      .max(20, "Informe no máximo 20 termos por execução"),
    city: z
      .string()
      .trim()
      .min(2, "Cidade precisa ter ao menos 2 caracteres")
      .max(80, "Cidade muito longa"),
    state: z
      .string()
      .trim()
      .min(2, "Estado precisa ter ao menos 2 caracteres")
      .max(40, "Estado muito longo")
      .transform((value) => value.toUpperCase()),
    maxCrawledPlacesPerSearch: z
      .number()
      .int("Quantidade precisa ser um número inteiro")
      .min(1, "Quantidade mínima é 1")
      .max(500, "Quantidade máxima é 500")
      .default(50),
  })
  .strict();

export type SearchFormInput = z.infer<typeof searchFormSchema>;
export type SearchFormValues = z.input<typeof searchFormSchema>;

// Instagram search ---------------------------------------------------------

export const searchInstagramSchema = z
  .object({
    search: z.string().trim().min(2, "Termo de busca muito curto").max(120),
    searchType: z.enum(["user", "hashtag"]).default("user"),
    resultsLimit: z.coerce
      .number()
      .int()
      .min(1)
      .max(200)
      .default(50),
  })
  .strict();

export type SearchInstagramInput = z.infer<typeof searchInstagramSchema>;

export function buildGoogleMapsSearchInput(
  values: SearchFormInput,
): SearchGoogleMapsInput {
  return searchGoogleMapsSchema.parse({
    searchStringsArray: values.terms.map(
      (term) => `${term} ${values.city} ${values.state}`,
    ),
    maxCrawledPlacesPerSearch: values.maxCrawledPlacesPerSearch,
    language: "pt-BR",
    countryCode: "br",
  });
}
