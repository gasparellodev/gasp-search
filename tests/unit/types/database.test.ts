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
    expectTypeOf<WhatsAppRow["evo_instance_v2"]>().toBeString();
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

  it("Database['public']['Tables'] cobre as 18 tabelas esperadas (incluindo consent_logs do P3 #234 + Iara Fase 1 #0025)", () => {
    type TableNames = keyof Database["public"]["Tables"];
    expectTypeOf<TableNames>().toEqualTypeOf<
      | "profiles"
      | "tags"
      | "search_jobs"
      | "leads"
      | "lead_tags"
      | "lead_messages"
      | "lead_form_submissions"
      | "consent_logs"
      | "whatsapp_instances"
      | "campaigns"
      | "campaign_targets"
      | "lead_sites"
      | "generation_throttle"
      | "whatsapp_conversations"
      | "iara_messages"
      | "iara_handoffs"
      | "iara_scheduled_followups"
      | "iara_demand_signals"
    >();
  });

  it("Tables<'consent_logs'> modela auditoria LGPD granular", () => {
    type ConsentLogRow = Tables<"consent_logs">;
    expectTypeOf<ConsentLogRow["id"]>().toBeString();
    expectTypeOf<ConsentLogRow["user_id"]>().toEqualTypeOf<string | null>();
    expectTypeOf<ConsentLogRow["ip"]>().toEqualTypeOf<string | null>();
    expectTypeOf<ConsentLogRow["user_agent"]>().toEqualTypeOf<string | null>();
    expectTypeOf<ConsentLogRow["timestamp"]>().toBeString();
    expectTypeOf<ConsentLogRow["consent_text"]>().toBeString();
    expectTypeOf<ConsentLogRow["version"]>().toBeString();
    expectTypeOf<ConsentLogRow["action"]>().toEqualTypeOf<
      "accept_all" | "accept_selected" | "reject"
    >();
    expectTypeOf<ConsentLogRow["categories"]>().toEqualTypeOf<
      import("@/types/database").Json
    >();
    expectTypeOf<ConsentLogRow["created_at"]>().toBeString();
  });

  it("TablesInsert<'consent_logs'> exige campos de decisão e permite visitante anônimo", () => {
    type ConsentLogInsert = TablesInsert<"consent_logs">;
    const sample: ConsentLogInsert = {
      user_id: null,
      ip: null,
      user_agent: null,
      timestamp: "2026-05-12T00:00:00.000Z",
      consent_text: "copy",
      version: "v1",
      action: "reject",
      categories: {
        necessary: true,
        analytics: false,
        marketing: false,
      },
    };
    expect(sample).toBeDefined();
  });

  it("Tables<'lead_sites'> tem todas as 17 colunas tipadas (AC8 #153 + archived_at #169 + signed_at #199 + visual_identity #215)", () => {
    type LeadSiteRow = Tables<"lead_sites">;
    expectTypeOf<LeadSiteRow["id"]>().toBeString();
    expectTypeOf<LeadSiteRow["user_id"]>().toBeString();
    expectTypeOf<LeadSiteRow["lead_id"]>().toBeString();
    expectTypeOf<LeadSiteRow["slug"]>().toBeString();
    expectTypeOf<LeadSiteRow["status"]>().toEqualTypeOf<
      Enums<"lead_site_status">
    >();
    // variables é jsonb na DB → Json no TS (validado em runtime via Zod, ver M1.2).
    // visual_identity é jsonb nullable na DB → Json | null no TS (#215, validado
    // em runtime via VisualIdentityManifestSchema em types/visual-identity.ts).
    expectTypeOf<LeadSiteRow["visual_identity"]>().toEqualTypeOf<
      import("@/types/database").Json | null
    >();
    expectTypeOf<LeadSiteRow["generation_error"]>().toEqualTypeOf<
      string | null
    >();
    expectTypeOf<LeadSiteRow["generated_at"]>().toEqualTypeOf<string | null>();
    expectTypeOf<LeadSiteRow["published_at"]>().toEqualTypeOf<string | null>();
    expectTypeOf<LeadSiteRow["sent_at"]>().toEqualTypeOf<string | null>();
    expectTypeOf<LeadSiteRow["archived_at"]>().toEqualTypeOf<string | null>();
    expectTypeOf<LeadSiteRow["view_count"]>().toBeNumber();
    expectTypeOf<LeadSiteRow["last_viewed_at"]>().toEqualTypeOf<
      string | null
    >();
    expectTypeOf<LeadSiteRow["created_at"]>().toBeString();
    expectTypeOf<LeadSiteRow["updated_at"]>().toBeString();

    // Sanity: todas as 17 colunas estão presentes (não mais, não menos).
    // `signed_at` adicionado em #199 (migration 0018) — habilita o gate
    // `isIndexable(site)` em `lib/sites/metadata.ts` (SEO foundation).
    // `visual_identity` adicionado em #215 (migration 0019) — foundation
    // pra Sprint 2 #A2 (generateVisualIdentity action em #216).
    type Cols = keyof LeadSiteRow;
    expectTypeOf<Cols>().toEqualTypeOf<
      | "id"
      | "user_id"
      | "lead_id"
      | "slug"
      | "status"
      | "variables"
      | "visual_identity"
      | "generation_error"
      | "generated_at"
      | "published_at"
      | "sent_at"
      | "signed_at"
      | "archived_at"
      | "view_count"
      | "last_viewed_at"
      | "created_at"
      | "updated_at"
    >();
  });

  it("Enums<'lead_site_status'> tem 4 valores casando a check constraint", () => {
    expectTypeOf<Enums<"lead_site_status">>().toEqualTypeOf<
      "draft" | "published" | "sent" | "archived"
    >();
  });

  it("TablesInsert<'lead_sites'> exige user_id, lead_id e slug; demais opcionais via defaults", () => {
    type LeadSiteInsert = TablesInsert<"lead_sites">;
    const sample: LeadSiteInsert = {
      user_id: "u1",
      lead_id: "l1",
      slug: "barbearia-bigode-abc123",
    };
    expect(sample).toBeDefined();
  });

  it("TablesUpdate<'lead_sites'> permite atualização parcial (status, view_count, etc.)", () => {
    type LeadSiteUpdate = TablesUpdate<"lead_sites">;
    const sample: LeadSiteUpdate = {
      status: "published",
      published_at: new Date().toISOString(),
    };
    expect(sample.status).toBe("published");
  });
});
