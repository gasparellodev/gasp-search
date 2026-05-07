import { describe, expect, it } from "vitest";
import {
  AI_MESSAGE_CHANNELS,
  AI_MESSAGE_TONES,
  generateMessageSchema,
} from "@/lib/validators/ai";

describe("generateMessageSchema", () => {
  it("aceita leadId UUID, canal, tom e objetivo", () => {
    const parsed = generateMessageSchema.parse({
      leadId: "11111111-1111-4111-8111-111111111111",
      channel: "whatsapp",
      tone: "consultivo",
      goal: "agendar conversa sobre novo site",
    });

    expect(parsed).toEqual({
      leadId: "11111111-1111-4111-8111-111111111111",
      channel: "whatsapp",
      tone: "consultivo",
      goal: "agendar conversa sobre novo site",
    });
  });

  it("aplica objetivo default quando ausente", () => {
    const parsed = generateMessageSchema.parse({
      leadId: "11111111-1111-4111-8111-111111111111",
      channel: "email",
      tone: "direto",
    });

    expect(parsed.goal).toBe("iniciar uma conversa comercial");
  });

  it("rejeita ids e opções fora das listas permitidas", () => {
    expect(
      generateMessageSchema.safeParse({
        leadId: "lead-1",
        channel: "sms",
        tone: "agressivo",
      }).success,
    ).toBe(false);
  });

  it("exporta opções estáveis para os selects de UI", () => {
    expect(AI_MESSAGE_CHANNELS).toEqual([
      "whatsapp",
      "email",
      "instagram",
      "linkedin",
    ]);
    expect(AI_MESSAGE_TONES).toEqual([
      "consultivo",
      "direto",
      "amigavel",
      "formal",
    ]);
  });
});
