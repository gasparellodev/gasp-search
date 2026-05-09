/**
 * Schema Zod do `AnnounceForm` (form da página `/sites/[slug]/anunciar`
 * — issue #163). Compartilhado entre Client Component (`react-hook-form`
 * + `zodResolver`) e Server Action (`submitAnnouncement`) — fonte única
 * de verdade para validação.
 *
 * Campos (per AC4 + AC body refinado pelo PO):
 *   - `marca`: marca do veículo (livre).
 *   - `modelo`: modelo do veículo (livre).
 *   - `ano`: ano (1980 .. currentYear+1).
 *   - `km`: quilometragem (≥ 0).
 *   - `preco`: preço pretendido (≥ 0; opcional).
 *   - `nome`/`telefone`/`email`: contato.
 *   - `mensagem`: descrição livre (opcional, max 1000).
 *   - `lgpd_consent`: consentimento explícito (`literal(true)`).
 *
 * `telefone` aceita formatação livre (espaços, parênteses, hífens). A
 * normalização para `^\d{10,13}$` (formato persistido em
 * `lead_sites.variables.whatsapp`) acontece no caller quando/se a
 * persistência for ligada — fora de escopo do MVP V1 (stub).
 *
 * V1 stub: `submitAnnouncement` valida e retorna `{ ok: true }` sem
 * persistir. Persistência em `lead_announcements` (tabela ainda não
 * existe) é follow-up.
 */

import { z } from "zod";

const PT_REQUIRED = "Campo obrigatório";

const currentYear = new Date().getFullYear();

export const AnnouncementSchema = z.object({
  marca: z.string().trim().min(1, PT_REQUIRED).max(60),
  modelo: z.string().trim().min(1, PT_REQUIRED).max(120),
  ano: z
    .number({ error: "Ano inválido" })
    .int("Ano deve ser inteiro")
    .min(1980, "Ano mínimo: 1980")
    .max(currentYear + 1, `Ano máximo: ${currentYear + 1}`),
  km: z
    .number({ error: "KM inválido" })
    .int("KM deve ser inteiro")
    .min(0, "KM não pode ser negativo"),
  preco: z
    .number({ error: "Preço inválido" })
    .min(0, "Preço não pode ser negativo")
    .nullable()
    .optional(),
  nome: z.string().trim().min(1, PT_REQUIRED).max(120),
  telefone: z
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
  email: z.string().trim().email("E-mail inválido").max(160),
  mensagem: z.string().trim().max(1000).optional(),
  lgpd_consent: z.literal(true, {
    error: "É preciso aceitar a Política de Privacidade",
  }),
});

export type AnnouncementInput = z.infer<typeof AnnouncementSchema>;
