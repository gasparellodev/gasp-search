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
 *  - `message` (opt — adicionado #223 / H3): mensagem livre, 10-1000 chars
 *    quando informado. `<SiteForm variant='home'|'contact'|'car-detail'>` não
 *    renderiza este input — apenas `<HomeContactFormQuick>` (#223) o expõe.
 *    Permanece **opcional no schema** pra não quebrar callers V1.
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
  message: z
    .string()
    .trim()
    .min(10, "Mensagem deve ter ao menos 10 caracteres")
    .max(1000, "Mensagem não pode exceder 1000 caracteres")
    .optional(),
  lgpd: z.literal(true, {
    error: "É preciso aceitar a Política de Privacidade",
  }),
});

export type SiteFormInput = z.infer<typeof SiteFormSchema>;
