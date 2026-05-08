import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_MAX_LEADS,
  createCampaignSchema,
  updateCampaignSchema,
} from "@/lib/validators/campaigns";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

describe("createCampaignSchema", () => {
  it("aceita modo template com templateText", () => {
    const r = createCampaignSchema.safeParse({
      name: "Camp 1",
      mode: "template",
      templateText: "Olá {{nome}}",
      leadIds: [VALID_UUID],
    });
    expect(r.success).toBe(true);
  });

  it("rejeita modo template sem templateText", () => {
    const r = createCampaignSchema.safeParse({
      name: "Camp 1",
      mode: "template",
      leadIds: [VALID_UUID],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(["templateText"]);
    }
  });

  it("aceita modo ai_per_lead com channel+tone", () => {
    const r = createCampaignSchema.safeParse({
      name: "Camp 2",
      mode: "ai_per_lead",
      aiChannel: "whatsapp",
      aiTone: "consultivo",
      leadIds: [VALID_UUID],
    });
    expect(r.success).toBe(true);
  });

  it("rejeita modo ai_per_lead sem channel ou tone", () => {
    const r = createCampaignSchema.safeParse({
      name: "Camp 2",
      mode: "ai_per_lead",
      leadIds: [VALID_UUID],
    });
    expect(r.success).toBe(false);
  });

  it("rejeita 0 leads e mais que 50 leads", () => {
    expect(
      createCampaignSchema.safeParse({
        name: "x",
        mode: "template",
        templateText: "y",
        leadIds: [],
      }).success,
    ).toBe(false);
    expect(
      createCampaignSchema.safeParse({
        name: "x",
        mode: "template",
        templateText: "y",
        leadIds: Array.from({ length: 51 }, () => VALID_UUID),
      }).success,
    ).toBe(false);
  });

  it("CAMPAIGN_MAX_LEADS = 50", () => {
    expect(CAMPAIGN_MAX_LEADS).toBe(50);
  });

  it("rejeita name vazio", () => {
    const r = createCampaignSchema.safeParse({
      name: "",
      mode: "template",
      templateText: "y",
      leadIds: [VALID_UUID],
    });
    expect(r.success).toBe(false);
  });
});

describe("updateCampaignSchema", () => {
  it("aceita action=cancel", () => {
    expect(
      updateCampaignSchema.safeParse({ action: "cancel" }).success,
    ).toBe(true);
  });
  it("rejeita action desconhecido", () => {
    expect(
      updateCampaignSchema.safeParse({ action: "pause" }).success,
    ).toBe(false);
  });
});
