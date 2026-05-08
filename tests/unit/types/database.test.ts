import { describe, expect, it, expectTypeOf } from "vitest";
import type {
  Database,
  Enums,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/types/database";

describe("types/database", () => {
  it("expõe enums esperados", () => {
    expectTypeOf<Enums<"search_source">>().toEqualTypeOf<
      "google_maps" | "instagram" | "website_contact"
    >();
    expectTypeOf<Enums<"search_status">>().toEqualTypeOf<
      "queued" | "running" | "succeeded" | "failed"
    >();
    expectTypeOf<Enums<"lead_stage">>().toEqualTypeOf<
      | "new"
      | "contacted"
      | "in_conversation"
      | "qualified"
      | "closed_won"
      | "closed_lost"
    >();
    expectTypeOf<Enums<"whatsapp_status">>().toEqualTypeOf<
      | "disconnected"
      | "qr_pending"
      | "connecting"
      | "connected"
      | "error"
    >();
    expectTypeOf<Enums<"campaign_mode">>().toEqualTypeOf<
      "template" | "ai_per_lead"
    >();
    expectTypeOf<Enums<"campaign_status">>().toEqualTypeOf<
      "draft" | "running" | "completed" | "failed" | "cancelled"
    >();
    expectTypeOf<Enums<"campaign_target_status">>().toEqualTypeOf<
      "pending" | "sent" | "failed" | "skipped"
    >();
    expectTypeOf<Enums<"lead_message_direction">>().toEqualTypeOf<
      "outbound" | "inbound"
    >();
    expectTypeOf<Enums<"lead_message_status">>().toEqualTypeOf<
      "queued" | "sent" | "delivered" | "read" | "failed"
    >();
  });

  it("Tables<'lead_messages'> ganha campos da Phase 5 (direction, status, whatsapp_msg_id, campaign_id, ai_generated)", () => {
    type LeadMessageRow = Tables<"lead_messages">;
    expectTypeOf<LeadMessageRow["direction"]>().toEqualTypeOf<
      Enums<"lead_message_direction">
    >();
    expectTypeOf<LeadMessageRow["status"]>().toEqualTypeOf<
      Enums<"lead_message_status">
    >();
    expectTypeOf<LeadMessageRow["whatsapp_msg_id"]>().toEqualTypeOf<
      string | null
    >();
    expectTypeOf<LeadMessageRow["campaign_id"]>().toEqualTypeOf<string | null>();
    expectTypeOf<LeadMessageRow["ai_generated"]>().toBeBoolean();
    expectTypeOf<LeadMessageRow["error_message"]>().toEqualTypeOf<
      string | null
    >();
  });

  it("Tables<'campaigns'> tem campos numéricos contadores e textuais opcionais", () => {
    type CampaignRow = Tables<"campaigns">;
    expectTypeOf<CampaignRow["mode"]>().toEqualTypeOf<Enums<"campaign_mode">>();
    expectTypeOf<CampaignRow["template_text"]>().toEqualTypeOf<string | null>();
    expectTypeOf<CampaignRow["ai_channel"]>().toEqualTypeOf<string | null>();
    expectTypeOf<CampaignRow["sent_count"]>().toBeNumber();
    expectTypeOf<CampaignRow["failed_count"]>().toBeNumber();
  });

  it("Tables<'campaign_targets'> usa PK composta (campaign_id, lead_id)", () => {
    type Target = Tables<"campaign_targets">;
    expectTypeOf<Target["campaign_id"]>().toBeString();
    expectTypeOf<Target["lead_id"]>().toBeString();
    expectTypeOf<Target["status"]>().toEqualTypeOf<
      Enums<"campaign_target_status">
    >();
    expectTypeOf<Target["sent_message_id"]>().toEqualTypeOf<string | null>();
  });

  it("Tables<'whatsapp_instances'> tem user_id e status, com phone_number nullable", () => {
    type WhatsAppRow = Tables<"whatsapp_instances">;
    expectTypeOf<WhatsAppRow["id"]>().toBeString();
    expectTypeOf<WhatsAppRow["user_id"]>().toBeString();
    expectTypeOf<WhatsAppRow["evo_instance"]>().toBeString();
    expectTypeOf<WhatsAppRow["status"]>().toEqualTypeOf<
      Enums<"whatsapp_status">
    >();
    expectTypeOf<WhatsAppRow["phone_number"]>().toEqualTypeOf<string | null>();
    expectTypeOf<WhatsAppRow["qr_code"]>().toEqualTypeOf<string | null>();
  });

  it("Tables<'leads'> tem campos de identidade obrigatórios e contato opcional", () => {
    type LeadRow = Tables<"leads">;
    expectTypeOf<LeadRow["id"]>().toBeString();
    expectTypeOf<LeadRow["user_id"]>().toBeString();
    expectTypeOf<LeadRow["name"]>().toBeString();
    expectTypeOf<LeadRow["email"]>().toEqualTypeOf<string | null>();
    expectTypeOf<LeadRow["website"]>().toEqualTypeOf<string | null>();
    expectTypeOf<LeadRow["score"]>().toBeNumber();
  });

  it("TablesInsert<'leads'> exige campos non-null sem defaults", () => {
    type LeadInsert = TablesInsert<"leads">;
    // user_id, source e name não têm default no schema → obrigatórios.
    const sample: LeadInsert = {
      user_id: "u1",
      source: "google_maps",
      name: "Barbearia Bigode",
    };
    expect(sample).toBeDefined();
  });

  it("TablesUpdate<'leads'> permite atualização parcial", () => {
    type LeadUpdate = TablesUpdate<"leads">;
    const sample: LeadUpdate = { stage: "qualified" };
    expect(sample.stage).toBe("qualified");
  });

  it("lead_tags é a junction M:N com PK composta lógica", () => {
    type LeadTag = Tables<"lead_tags">;
    expectTypeOf<LeadTag>().toEqualTypeOf<{
      lead_id: string;
      tag_id: string;
    }>();
  });

  it("Database['public']['Tables'] cobre as 9 tabelas esperadas", () => {
    type TableNames = keyof Database["public"]["Tables"];
    expectTypeOf<TableNames>().toEqualTypeOf<
      | "profiles"
      | "tags"
      | "search_jobs"
      | "leads"
      | "lead_tags"
      | "lead_messages"
      | "whatsapp_instances"
      | "campaigns"
      | "campaign_targets"
    >();
  });
});
