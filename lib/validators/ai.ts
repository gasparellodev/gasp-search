import { z } from "zod";

export const AI_MESSAGE_CHANNELS = [
  "whatsapp",
  "email",
  "instagram",
  "linkedin",
] as const;
export type AiMessageChannel = (typeof AI_MESSAGE_CHANNELS)[number];

export const AI_MESSAGE_TONES = [
  "consultivo",
  "direto",
  "amigavel",
  "formal",
] as const;
export type AiMessageTone = (typeof AI_MESSAGE_TONES)[number];

export const generateMessageSchema = z
  .object({
    leadId: z.string().uuid("leadId precisa ser um UUID válido"),
    channel: z.enum(AI_MESSAGE_CHANNELS),
    tone: z.enum(AI_MESSAGE_TONES),
    goal: z
      .string()
      .trim()
      .min(3)
      .max(240)
      .optional()
      .default("iniciar uma conversa comercial"),
  })
  .strict();

export type GenerateMessageInput = z.infer<typeof generateMessageSchema>;
