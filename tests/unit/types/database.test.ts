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

  it("Database['public']['Tables'] cobre as 6 tabelas esperadas", () => {
    type TableNames = keyof Database["public"]["Tables"];
    expectTypeOf<TableNames>().toEqualTypeOf<
      "profiles" | "tags" | "search_jobs" | "leads" | "lead_tags" | "lead_messages"
    >();
  });
});
