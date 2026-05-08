import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    EVOLUTION_API_URL: "http://localhost:8080",
    EVOLUTION_API_KEY: "k",
  },
}));

const evolutionMocks = vi.hoisted(() => ({
  sendText: vi.fn(),
  createEvolutionClient: vi.fn(),
}));

vi.mock("@/lib/evolution/client", () => ({
  createEvolutionClient: evolutionMocks.createEvolutionClient,
  EvolutionApiError: class EvolutionApiError extends Error {
    constructor(
      message: string,
      public options: { status: number; code: string },
    ) {
      super(message);
      this.name = "EvolutionApiError";
    }
    get code() {
      return this.options.code;
    }
    get status() {
      return this.options.status;
    }
  },
}));

const { sendWhatsAppMessage } = await import("@/lib/evolution/send");

type SelectChain = { data?: unknown; error?: unknown };

function makeSupabase(opts: {
  instance?: SelectChain;
  lead?: SelectChain;
  insertResult?: { data?: unknown; error?: unknown };
  updateError?: unknown;
  leadUpdateError?: unknown;
}) {
  const updates: Array<{ table: string; payload: unknown; id: unknown }> = [];

  const buildSelect = (chain: SelectChain | undefined) => {
    const maybeSingle = vi.fn(async () => ({
      data: chain?.data ?? null,
      error: chain?.error ?? null,
    }));
    const eq = vi.fn(() => ({ maybeSingle }));
    return { eq, select: vi.fn(() => ({ eq })) };
  };

  const tables: Record<
    string,
    { select?: () => unknown; insert?: unknown; update?: unknown }
  > = {};

  // whatsapp_instances.select
  tables.whatsapp_instances = {
    select: () => buildSelect(opts.instance).select(),
  };

  // leads.select + leads.update
  const leadsLeadUpdateEq = vi.fn(async () => ({
    error: opts.leadUpdateError ?? null,
  }));
  tables.leads = {
    select: () => buildSelect(opts.lead).select(),
    update: vi.fn((payload: unknown) => ({
      eq: vi.fn((_col: string, id: unknown) => {
        updates.push({ table: "leads", payload, id });
        return leadsLeadUpdateEq();
      }),
    })),
  };

  // lead_messages.insert + .update
  const insertSelectSingle = vi.fn(async () => ({
    data: opts.insertResult?.data ?? { id: "msg-1" },
    error: opts.insertResult?.error ?? null,
  }));
  const insertSelect = vi.fn(() => ({ single: insertSelectSingle }));
  const insertFn = vi.fn(() => ({ select: insertSelect }));

  const messageUpdateEq = vi.fn(async () => ({
    error: opts.updateError ?? null,
  }));
  tables.lead_messages = {
    insert: insertFn,
    update: vi.fn((payload: unknown) => ({
      eq: vi.fn((_col: string, id: unknown) => {
        updates.push({ table: "lead_messages", payload, id });
        return messageUpdateEq();
      }),
    })),
  };

  const from = vi.fn((tableName: string) => {
    const t = tables[tableName];
    if (!t) throw new Error(`unexpected from(${tableName})`);
    return t;
  });

  return {
    client: { from } as unknown as Parameters<typeof sendWhatsAppMessage>[0]["supabase"],
    spies: { from, insertFn, updates },
  };
}

beforeEach(() => {
  evolutionMocks.sendText.mockReset();
  evolutionMocks.createEvolutionClient.mockReset();
  evolutionMocks.createEvolutionClient.mockReturnValue({
    sendText: evolutionMocks.sendText,
    createInstance: vi.fn(),
    deleteInstance: vi.fn(),
    getQRCode: vi.fn(),
    getStatus: vi.fn(),
  });
});

const baseInput = {
  userId: "user-1",
  leadId: "lead-1",
  content: "Olá",
};

describe("sendWhatsAppMessage", () => {
  it("retorna instance_disconnected quando não há instância", async () => {
    const { client } = makeSupabase({ instance: { data: null } });
    const result = await sendWhatsAppMessage({ supabase: client, ...baseInput });
    expect(result).toEqual({ ok: false, reason: "instance_disconnected" });
  });

  it("retorna instance_disconnected quando status != connected", async () => {
    const { client } = makeSupabase({
      instance: { data: { evo_instance: "u_x", status: "qr_pending" } },
    });
    const result = await sendWhatsAppMessage({ supabase: client, ...baseInput });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("instance_disconnected");
  });

  it("retorna lead_not_found", async () => {
    const { client } = makeSupabase({
      instance: { data: { evo_instance: "u_x", status: "connected" } },
      lead: { data: null },
    });
    const result = await sendWhatsAppMessage({ supabase: client, ...baseInput });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("lead_not_found");
  });

  it("retorna lead_missing_phone quando lead sem phone/whatsapp", async () => {
    const { client } = makeSupabase({
      instance: { data: { evo_instance: "u_x", status: "connected" } },
      lead: { data: { id: "lead-1", phone: null, whatsapp: null, stage: "new" } },
    });
    const result = await sendWhatsAppMessage({ supabase: client, ...baseInput });
    if (!result.ok) expect(result.reason).toBe("lead_missing_phone");
  });

  it("happy path: insere queued, envia, atualiza pra sent e promove stage new→contacted", async () => {
    const { client, spies } = makeSupabase({
      instance: { data: { evo_instance: "u_x", status: "connected" } },
      lead: {
        data: {
          id: "lead-1",
          phone: "11 99999-8888",
          whatsapp: null,
          stage: "new",
        },
      },
      insertResult: { data: { id: "msg-1" } },
    });
    evolutionMocks.sendText.mockResolvedValue({
      messageId: "evo-1",
      status: "PENDING",
    });

    const result = await sendWhatsAppMessage({
      supabase: client,
      ...baseInput,
    });

    expect(result).toEqual({
      ok: true,
      messageId: "msg-1",
      whatsappMsgId: "evo-1",
    });
    expect(evolutionMocks.sendText).toHaveBeenCalledWith(
      "u_x",
      "11999998888",
      "Olá",
    );
    // INSERT em lead_messages com status=queued, direction=outbound
    expect(spies.insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_id: "lead-1",
        user_id: "user-1",
        channel: "whatsapp",
        content: "Olá",
        direction: "outbound",
        status: "queued",
        ai_generated: false,
        campaign_id: null,
      }),
    );
    // UPDATE pra sent + promoção do stage
    const updates = spies.updates;
    expect(updates).toContainEqual(
      expect.objectContaining({
        table: "lead_messages",
        payload: { status: "sent", whatsapp_msg_id: "evo-1" },
        id: "msg-1",
      }),
    );
    expect(updates).toContainEqual(
      expect.objectContaining({
        table: "leads",
        payload: { stage: "contacted" },
        id: "lead-1",
      }),
    );
  });

  it("usa whatsapp em vez de phone quando ambos existem", async () => {
    const { client } = makeSupabase({
      instance: { data: { evo_instance: "u_x", status: "connected" } },
      lead: {
        data: {
          id: "lead-1",
          phone: "1133",
          whatsapp: "5511999998888",
          stage: "contacted",
        },
      },
    });
    evolutionMocks.sendText.mockResolvedValue({
      messageId: "evo-1",
      status: "ok",
    });
    await sendWhatsAppMessage({ supabase: client, ...baseInput });
    expect(evolutionMocks.sendText).toHaveBeenCalledWith(
      "u_x",
      "5511999998888",
      "Olá",
    );
  });

  it("não promove stage se já passou de contacted", async () => {
    const { client, spies } = makeSupabase({
      instance: { data: { evo_instance: "u_x", status: "connected" } },
      lead: {
        data: {
          id: "lead-1",
          phone: "11999998888",
          whatsapp: null,
          stage: "qualified",
        },
      },
    });
    evolutionMocks.sendText.mockResolvedValue({ messageId: "x", status: "ok" });
    await sendWhatsAppMessage({ supabase: client, ...baseInput });
    const updates = spies.updates;
    expect(updates.some((u) => u.table === "leads")).toBe(false);
  });

  it("erro do Evolution: marca message como failed com error_message", async () => {
    const { client, spies } = makeSupabase({
      instance: { data: { evo_instance: "u_x", status: "connected" } },
      lead: {
        data: {
          id: "lead-1",
          phone: "11999998888",
          whatsapp: null,
          stage: "new",
        },
      },
      insertResult: { data: { id: "msg-1" } },
    });
    evolutionMocks.sendText.mockRejectedValue(new Error("boom"));
    const result = await sendWhatsAppMessage({
      supabase: client,
      ...baseInput,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("evolution_error");
      expect(result.messageId).toBe("msg-1");
    }
    expect(spies.updates).toContainEqual(
      expect.objectContaining({
        table: "lead_messages",
        payload: expect.objectContaining({
          status: "failed",
          error_message: expect.stringContaining("boom"),
        }),
      }),
    );
  });

  it("propaga campaignId e aiGenerated no INSERT", async () => {
    const { client, spies } = makeSupabase({
      instance: { data: { evo_instance: "u_x", status: "connected" } },
      lead: {
        data: {
          id: "lead-1",
          phone: "11999998888",
          whatsapp: null,
          stage: "new",
        },
      },
    });
    evolutionMocks.sendText.mockResolvedValue({ messageId: "x", status: "ok" });
    await sendWhatsAppMessage({
      supabase: client,
      ...baseInput,
      campaignId: "camp-1",
      aiGenerated: true,
    });
    expect(spies.insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        campaign_id: "camp-1",
        ai_generated: true,
      }),
    );
  });
});
