import { z } from "zod";
import {
  AI_MESSAGE_CHANNELS,
  AI_MESSAGE_TONES,
} from "@/lib/validators/ai";

export const CAMPAIGN_MAX_LEADS = 50;

export const createCampaignSchema = z
  .object({
    name: z.string().trim().min(1, "Nome obrigatório").max(120),
    leadIds: z
      .array(z.string().uuid())
      .min(1, "Selecione ao menos 1 lead")
      .max(CAMPAIGN_MAX_LEADS, `Máximo ${CAMPAIGN_MAX_LEADS} leads`),
    mode: z.enum(["template", "ai_per_lead"]),
    templateText: z.string().trim().min(1).max(4096).optional(),
    aiChannel: z.enum(AI_MESSAGE_CHANNELS).optional(),
    aiTone: z.enum(AI_MESSAGE_TONES).optional(),
    aiGoal: z.string().trim().min(3).max(240).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "template") {
      if (!data.templateText) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["templateText"],
          message: "templateText obrigatório quando mode='template'",
        });
      }
    } else if (data.mode === "ai_per_lead") {
      if (!data.aiChannel) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["aiChannel"],
          message: "aiChannel obrigatório quando mode='ai_per_lead'",
        });
      }
      if (!data.aiTone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["aiTone"],
          message: "aiTone obrigatório quando mode='ai_per_lead'",
        });
      }
    }
  });

export type CreateCampaignBody = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = z.object({
  action: z.enum(["cancel"]),
});
export type UpdateCampaignBody = z.infer<typeof updateCampaignSchema>;
