/**
 * Schema Zod do `SiteForm` (componente público de captura de lead — issue
 * #161). Compartilhado entre Client Component (`react-hook-form` +
 * `zodResolver`) e Server Action (`submitSiteForm`) — fonte única de verdade
 * para validação.
 *
 * Campos:
 *  - `model`: modelo de carro de interesse (livre); read-only quando o form
 *    aparece em `CarDetail`.
 *  - `name`/`email`/`phone`: contato.
 *  - `lgpd`: consentimento explícito (obrigatório).
 *
 * `phone` aceita qualquer formatação (espaços, parênteses, hífens). A
 * normalização para `^\d{10,13}$` (formato persistido em
 * `lead_sites.variables.whatsapp`) acontece no caller quando/se a
 * persistência for ligada — fora de escopo do MVP.
 */

import { z } from "zod";

const PT_REQUIRED = "Campo obrigatório";

export const SiteFormSchema = z.object({
  model: z.string().trim().min(1, PT_REQUIRED).max(120),
  name: z.string().trim().min(1, PT_REQUIRED).max(120),
  email: z.string().trim().email("Email inválido").max(160),
  phone: z
    .string()
    .trim()
    .min(1, PT_REQUIRED)
    .refine(
      (val) => val.replace(/\D/g, "").length >= 10,
      "Telefone inválido (mínimo 10 dígitos)",
    )
    .refine(
      (val) => val.replace(/\D/g, "").length <= 13,
      "Telefone inválido (máximo 13 dígitos)",
    ),
  lgpd: z.literal(true, {
    error: "É preciso aceitar a Política de Privacidade",
  }),
});

export type SiteFormInput = z.infer<typeof SiteFormSchema>;
