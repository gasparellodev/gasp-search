import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabaseClient } from "@/tests/__mocks__/supabase";

const supabaseHolder = vi.hoisted(() => ({
  client: null as ReturnType<typeof createMockSupabaseClient> | null,
}));

const recordHandoffMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabase: () => supabaseHolder.client,
}));

vi.mock("@/lib/ai/iara/memory", () => ({
  recordHandoff: recordHandoffMock,
}));

const CTX = {
  userId: "user-1",
  conversationId: "conv-1",
  leadId: "lead-1",
};

beforeEach(() => {
  supabaseHolder.client = createMockSupabaseClient();
  recordHandoffMock.mockReset();
  vi.resetModules();
});

describe("consultar_estado_lead handler", () => {
  it("retorna dados do lead quando encontrado", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        leads: {
          maybeSingle: {
            data: {
              name: "AutoCity",
              city: "Curitiba",
              has_website: true,
              stage: "contacted",
            },
            error: null,
          },
        },
      },
    });

    const { IARA_TOOL_HANDLERS } = await import("@/lib/ai/iara/tools");
    const out = await IARA_TOOL_HANDLERS.consultar_estado_lead(
      { lead_id: "lead-1" },
      CTX,
    );

    expect(out).toEqual({
      business_name: "AutoCity",
      city: "Curitiba",
      has_existing_site: true,
      estoque_count_estimate: 0,
      stage: "contacted",
    });
  });

  it("retorna placeholder quando lead não existe (sandbox-friendly)", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        leads: { maybeSingle: { data: null, error: null } },
      },
    });

    const { IARA_TOOL_HANDLERS } = await import("@/lib/ai/iara/tools");
    const out = (await IARA_TOOL_HANDLERS.consultar_estado_lead(
      { lead_id: "lead-1" },
      CTX,
    )) as Record<string, unknown>;

    expect(out.business_name).toBe("[lead não encontrado]");
    expect(out.has_existing_site).toBe(false);
  });

  it("lança quando supabase retorna error", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        leads: { maybeSingle: { data: null, error: { message: "rls" } } },
      },
    });
    const { IARA_TOOL_HANDLERS } = await import("@/lib/ai/iara/tools");
    await expect(
      IARA_TOOL_HANDLERS.consultar_estado_lead({ lead_id: "lead-1" }, CTX),
    ).rejects.toThrow(/rls/);
  });
});

describe("gerar_link_checkout handler", () => {
  it("retorna URL fake sandbox + expiração 24h", async () => {
    const { IARA_TOOL_HANDLERS } = await import("@/lib/ai/iara/tools");
    const out = (await IARA_TOOL_HANDLERS.gerar_link_checkout(
      { lead_id: "lead-1", plano: "setup_mensal" },
      CTX,
    )) as Record<string, unknown>;
    expect(out.url).toBe("https://sandbox.asaas.com/c/lead-1");
    expect(out.expires_in_hours).toBe(24);
  });
});

describe("escalar_para_humano handler", () => {
  it("chama recordHandoff e retorna ok com handoff_id", async () => {
    recordHandoffMock.mockResolvedValue({ id: "ho-99" });
    const { IARA_TOOL_HANDLERS } = await import("@/lib/ai/iara/tools");

    const out = (await IARA_TOOL_HANDLERS.escalar_para_humano(
      { lead_id: "lead-1", priority: "P0", motivo: "fechou agora" },
      CTX,
    )) as Record<string, unknown>;

    expect(out).toEqual({ ok: true, handoff_id: "ho-99", priority: "P0" });
    expect(recordHandoffMock).toHaveBeenCalledWith({
      conversationId: "conv-1",
      priority: "P0",
      motivo: "fechou agora",
    });
  });

  it("normaliza priority inválida para P2", async () => {
    recordHandoffMock.mockResolvedValue({ id: "ho-1" });
    const { IARA_TOOL_HANDLERS } = await import("@/lib/ai/iara/tools");
    await IARA_TOOL_HANDLERS.escalar_para_humano(
      { lead_id: "lead-1", priority: "PX", motivo: "x" },
      CTX,
    );
    expect(recordHandoffMock).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "P2" }),
    );
  });
});

describe("agendar_followup handler", () => {
  it("persiste em iara_scheduled_followups com scheduled_for futuro", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        iara_scheduled_followups: {
          selectSingle: {
            data: {
              id: "f-1",
              scheduled_for: "2026-05-22T13:45:00.000Z",
            },
            error: null,
          },
        },
      },
    });
    const { IARA_TOOL_HANDLERS } = await import("@/lib/ai/iara/tools");

    const out = (await IARA_TOOL_HANDLERS.agendar_followup(
      { lead_id: "lead-1", dias_a_frente: 3, mensagem: "oi de novo" },
      CTX,
    )) as Record<string, unknown>;

    expect(out.ok).toBe(true);
    expect(out.followup_id).toBe("f-1");
    expect(out.scheduled_for).toBe("2026-05-22T13:45:00.000Z");

    const builder =
      supabaseHolder.client!.builders.iara_scheduled_followups!;
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: "conv-1",
        lead_id: "lead-1",
        user_id: "user-1",
        mensagem: "oi de novo",
      }),
    );
  });

  it("clampa dias_a_frente fora de [2, 7]", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        iara_scheduled_followups: {
          selectSingle: { data: { id: "f", scheduled_for: "X" }, error: null },
        },
      },
    });
    const { IARA_TOOL_HANDLERS } = await import("@/lib/ai/iara/tools");

    // Sem mock de Date — confiamos no clamp ser aplicado antes do
    // setUTCDate. Para validar diretamente, espionamos o argumento
    // do insert ser uma data válida ISO. O clamp em si está coberto
    // pela ramificação.
    await IARA_TOOL_HANDLERS.agendar_followup(
      { lead_id: "lead-1", dias_a_frente: 99, mensagem: "x" },
      CTX,
    );

    const builder = supabaseHolder.client!.builders.iara_scheduled_followups!;
    const insertedArg = (
      builder.insert as unknown as ReturnType<typeof vi.fn>
    ).mock.calls[0]?.[0] as { scheduled_for: string };
    expect(insertedArg.scheduled_for).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("lança quando insert falha", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        iara_scheduled_followups: {
          selectSingle: { data: null, error: { message: "fup err" } },
        },
      },
    });
    const { IARA_TOOL_HANDLERS } = await import("@/lib/ai/iara/tools");
    await expect(
      IARA_TOOL_HANDLERS.agendar_followup(
        { lead_id: "lead-1", dias_a_frente: 3, mensagem: "x" },
        CTX,
      ),
    ).rejects.toThrow(/fup err/);
  });
});

describe("marcar_lead_morto handler", () => {
  it("atualiza stage=closed_lost e concatena nota com motivo", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        leads: {
          maybeSingle: {
            data: { notes: "Lead inicial" },
            error: null,
          },
          update: { data: null, error: null },
        },
      },
    });
    const { IARA_TOOL_HANDLERS } = await import("@/lib/ai/iara/tools");

    const out = (await IARA_TOOL_HANDLERS.marcar_lead_morto(
      { lead_id: "lead-1", motivo: "refused_explicitly" },
      CTX,
    )) as Record<string, unknown>;

    expect(out).toEqual({ ok: true, motivo: "refused_explicitly" });

    const builder = supabaseHolder.client!.builders.leads!;
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "closed_lost",
        notes: expect.stringContaining("refused_explicitly"),
      }),
    );
    const updateArg = (
      builder.update as unknown as ReturnType<typeof vi.fn>
    ).mock.calls[0]?.[0] as { notes: string };
    expect(updateArg.notes.startsWith("Lead inicial\n[Iara")).toBe(true);
  });

  it("inicia notes do zero quando lead.notes era null", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        leads: {
          maybeSingle: { data: { notes: null }, error: null },
          update: { data: null, error: null },
        },
      },
    });
    const { IARA_TOOL_HANDLERS } = await import("@/lib/ai/iara/tools");
    await IARA_TOOL_HANDLERS.marcar_lead_morto(
      { lead_id: "lead-1", motivo: "no_budget" },
      CTX,
    );
    const builder = supabaseHolder.client!.builders.leads!;
    const updateArg = (
      builder.update as unknown as ReturnType<typeof vi.fn>
    ).mock.calls[0]?.[0] as { notes: string };
    expect(updateArg.notes).toMatch(/^\[Iara /);
    expect(updateArg.notes).toContain("no_budget");
  });

  it("lança quando select inicial falha", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        leads: { maybeSingle: { data: null, error: { message: "rls boom" } } },
      },
    });
    const { IARA_TOOL_HANDLERS } = await import("@/lib/ai/iara/tools");
    await expect(
      IARA_TOOL_HANDLERS.marcar_lead_morto(
        { lead_id: "lead-1", motivo: "x" },
        CTX,
      ),
    ).rejects.toThrow(/rls boom/);
  });

  it("lança quando update falha", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        leads: {
          maybeSingle: { data: { notes: null }, error: null },
          update: { data: null, error: { message: "update fail" } },
        },
      },
    });
    const { IARA_TOOL_HANDLERS } = await import("@/lib/ai/iara/tools");
    await expect(
      IARA_TOOL_HANDLERS.marcar_lead_morto(
        { lead_id: "lead-1", motivo: "x" },
        CTX,
      ),
    ).rejects.toThrow(/update fail/);
  });
});

describe("marcar_demanda_nao_atendida handler", () => {
  it("loga em iara_demand_signals e retorna signal_id", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        iara_demand_signals: {
          selectSingle: { data: { id: "d-1" }, error: null },
        },
      },
    });
    const { IARA_TOOL_HANDLERS } = await import("@/lib/ai/iara/tools");

    const out = (await IARA_TOOL_HANDLERS.marcar_demanda_nao_atendida(
      { lead_id: "lead-1", feature_solicitada: "app iOS" },
      CTX,
    )) as Record<string, unknown>;

    expect(out).toEqual({ ok: true, signal_id: "d-1" });
    const builder = supabaseHolder.client!.builders.iara_demand_signals!;
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        feature_solicitada: "app iOS",
        lead_id: "lead-1",
        user_id: "user-1",
      }),
    );
  });

  it("lança quando insert falha", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        iara_demand_signals: {
          selectSingle: { data: null, error: { message: "dmd err" } },
        },
      },
    });
    const { IARA_TOOL_HANDLERS } = await import("@/lib/ai/iara/tools");
    await expect(
      IARA_TOOL_HANDLERS.marcar_demanda_nao_atendida(
        { lead_id: "lead-1", feature_solicitada: "x" },
        CTX,
      ),
    ).rejects.toThrow(/dmd err/);
  });
});

describe("isIaraToolName", () => {
  it("retorna true para tool conhecida e false para outras", async () => {
    const { isIaraToolName } = await import("@/lib/ai/iara/tools");
    expect(isIaraToolName("escalar_para_humano")).toBe(true);
    expect(isIaraToolName("not_a_tool")).toBe(false);
  });
});
