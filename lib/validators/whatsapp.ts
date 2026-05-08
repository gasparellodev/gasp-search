import { z } from "zod";

// ----------------------------------------------------------------------------
// Schemas de respostas do Evolution API
// ----------------------------------------------------------------------------
//
// O Evolution costuma envelopar as respostas em formatos variados. Validamos
// o que precisamos com `passthrough()` para tolerar campos extras sem perder
// type safety nos campos que importam.
// ----------------------------------------------------------------------------

export const evolutionConnectionStateSchema = z.enum([
  "open",
  "connecting",
  "close",
  "qrReadError",
]);
export type EvolutionConnectionState = z.infer<
  typeof evolutionConnectionStateSchema
>;

export const evolutionInstanceCreateResponseSchema = z
  .object({
    instance: z
      .object({
        instanceName: z.string(),
        status: z.string().optional(),
      })
      .passthrough(),
    qrcode: z
      .object({
        base64: z.string().optional(),
        code: z.string().optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough();

export const evolutionQrResponseSchema = z
  .object({
    base64: z.string().optional(),
    code: z.string().optional(),
    pairingCode: z.string().optional().nullable(),
  })
  .passthrough();

export const evolutionInstanceStatusResponseSchema = z
  .object({
    instance: z
      .object({
        instanceName: z.string().optional(),
        state: z.string().optional(),
        status: z.string().optional(),
        owner: z.string().optional().nullable(),
        profilePictureUrl: z.string().optional().nullable(),
      })
      .passthrough()
      .optional(),
    state: z.string().optional(),
  })
  .passthrough();

export const evolutionSendTextResponseSchema = z
  .object({
    key: z
      .object({
        id: z.string(),
        remoteJid: z.string().optional(),
        fromMe: z.boolean().optional(),
      })
      .passthrough(),
    status: z.string().optional(),
    message: z.unknown().optional(),
  })
  .passthrough();

// ----------------------------------------------------------------------------
// Bodies de input das APIs internas (consumidas em #95/#97)
// ----------------------------------------------------------------------------

export const sendWhatsappMessageBodySchema = z.object({
  leadId: z.string().uuid("leadId precisa ser um UUID válido"),
  content: z
    .string()
    .trim()
    .min(1, "Mensagem vazia")
    .max(4096, "Mensagem maior que 4096 caracteres"),
});
export type SendWhatsappMessageBody = z.infer<
  typeof sendWhatsappMessageBodySchema
>;

export const createInstanceBodySchema = z
  .object({
    phoneNumber: z.string().trim().min(8).max(20).optional(),
  })
  .strict();
export type CreateInstanceBody = z.infer<typeof createInstanceBodySchema>;
