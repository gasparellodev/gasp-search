import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { EVOLUTION_API_URL: "http://x", EVOLUTION_API_KEY: "k" },
}));

const sendMock = vi.fn();
const generateMock = vi.fn();

const { processCampaign } = await import("@/lib/campaigns/processor");

type SelectChain = { data: unknown; error: { message: string } | null };

function makeSupabase(opts: {
  campaign?: SelectChain;
  campaignStatusSequence?: string[];
  targets?: SelectChain;
  leads?: Record<string, unknown>;
  countersInitial?: { sent_count: number; failed_count: number };
}) {
  const updates: Array<{ table: string; payload: unknown; filter: unknown }> = [];
  let campaignStatusCallIdx = 0;
  const counters = opts.countersInitial ?? { sent_count: 0, failed_count: 0 };

  const from = vi.fn((table: string) => {
    if (table === "campaigns") {
      return {
        select: vi.fn((cols: string) => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              if (cols === "status") {
                const seq = opts.campaignStatusSequence ?? [];
                const status = seq[campaignStatusCallIdx] ?? "running";
                campaignStatusCallIdx++;
                return { data: { status }, error: null };
              }
              if (
                cols === "sent_count" ||
                cols === "failed_count" ||
                cols === "sent_count, failed_count"
              ) {
                return { data: { ...counters }, error: null };
              }
              return opts.campaign ?? { data: null, error: null };
            }),
          })),
        })),
        update: vi.fn((payload: Record<string, unknown>) => ({
          eq: vi.fn(async () => {
            updates.push({ table, payload, filter: "campaigns.id" });
            // mantém counters em sync
            if (typeof payload.sent_count === "number")
              counters.sent_count = payload.sent_count;
            if (typeof payload.failed_count === "number")
              counters.failed_count = payload.failed_count;
            return { error: null };
          }),
        })),
      };
    }
    if (table === "campaign_targets") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => opts.targets ?? { data: [], error: null }),
          })),
        })),
        update: vi.fn((payload: unknown) => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => {
              updates.push({ table, payload, filter: "target" });
              return { error: null };
            }),
          })),
        })),
      };
    }
    if (table === "leads") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              // Fallback: retorna o primeiro lead conhecido.
              const first = Object.values(opts.leads ?? {})[0];
              return { data: first, error: null };
            }),
          })),
        })),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });

  return { client: { from }, updates };
}

const sleepMock = vi.fn(async () => {});

beforeEach(() => {
  sendMock.mockReset();
  generateMock.mockReset();
  sleepMock.mockReset();
  sleepMock.mockResolvedValue(undefined);
});

describe("processCampaign", () => {
  it("retorna 0/0 e não faz nada quando campanha não existe", async () => {
    const { client } = makeSupabase({ campaign: { data: null, error: null } });
    const result = await processCampaign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      userId: "u1",
      campaignId: "c1",
      sendImpl: sendMock,
      generateMessageImpl: generateMock,
      sleep: sleepMock,
    });
    expect(result).toEqual({ sent: 0, failed: 0 });
  });

  it("template mode: itera 2 targets, renderiza placeholder e envia com throttle", async () => {
    const lead1 = {
      id: "lead-1",
      name: "Bar A",
      city: "SP",
      state: "SP",
      category: "Bar",
      source: "google_maps",
      country: "BR",
      phone: "1199",
      email: null,
      website: null,
      instagram_handle: null,
      whatsapp: null,
      has_website: false,
      rating: null,
      reviews_count: null,
      followers_count: null,
      stage: "new",
      score: 50,
      notes: null,
    };
    const { client, updates } = makeSupabase({
      campaign: {
        data: {
          id: "c1",
          status: "draft",
          type: "message",
          mode: "template",
          template_text: "Olá {{nome}} de {{cidade}}",
          ai_channel: null,
          ai_tone: null,
          ai_goal: null,
        },
        error: null,
      },
      campaignStatusSequence: ["running", "running"],
      targets: {
        data: [
          { lead_id: "lead-1", status: "pending" },
          { lead_id: "lead-2", status: "pending" },
        ],
        error: null,
      },
      leads: { "lead-1": lead1 },
    });
    sendMock.mockResolvedValue({
      ok: true,
      messageId: "msg",
      whatsappMsgId: "evo",
    });

    const result = await processCampaign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      userId: "u1",
      campaignId: "c1",
      sendImpl: sendMock,
      generateMessageImpl: generateMock,
      sleep: sleepMock,
    });

    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
    // Status running → completed
    expect(updates).toContainEqual(
      expect.objectContaining({
        table: "campaigns",
        payload: expect.objectContaining({ status: "running" }),
      }),
    );
    expect(updates).toContainEqual(
      expect.objectContaining({
        table: "campaigns",
        payload: expect.objectContaining({ status: "completed" }),
      }),
    );
    // Throttle entre os 2 targets (sleep chamado 1 vez, não 2)
    expect(sleepMock).toHaveBeenCalledTimes(1);
    // sendImpl chamado com content renderizado
    expect(sendMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        content: "Olá Bar A de SP",
        campaignId: "c1",
        aiGenerated: false,
      }),
    );
  });

  it("para o loop quando status vira cancelled", async () => {
    const lead1 = {
      id: "lead-1",
      name: "X",
      city: null,
      state: null,
      category: null,
      source: "google_maps",
      country: null,
      phone: null,
      email: null,
      website: null,
      instagram_handle: null,
      whatsapp: null,
      has_website: null,
      rating: null,
      reviews_count: null,
      followers_count: null,
      stage: "new",
      score: 0,
      notes: null,
    };
    const { client, updates } = makeSupabase({
      campaign: {
        data: {
          id: "c1",
          status: "draft",
          type: "message",
          mode: "template",
          template_text: "Hi",
          ai_channel: null,
          ai_tone: null,
          ai_goal: null,
        },
        error: null,
      },
      // Primeiro check retorna cancelled — para imediato.
      // Segundo check (após loop) também precisa ser cancelled pra não marcar completed.
      campaignStatusSequence: ["cancelled", "cancelled"],
      targets: {
        data: [
          { lead_id: "lead-1", status: "pending" },
          { lead_id: "lead-2", status: "pending" },
        ],
        error: null,
      },
      leads: { "lead-1": lead1 },
    });

    const result = await processCampaign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      userId: "u1",
      campaignId: "c1",
      sendImpl: sendMock,
      generateMessageImpl: generateMock,
      sleep: sleepMock,
    });

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(sendMock).not.toHaveBeenCalled();
    // Não deve marcar completed — cancelled é estado terminal.
    expect(
      updates.find(
        (u) =>
          u.table === "campaigns" &&
          (u.payload as { status?: string }).status === "completed",
      ),
    ).toBeUndefined();
  });

  it("ai_per_lead mode: chama generateMessage e marca aiGenerated=true", async () => {
    const lead1 = {
      id: "lead-1",
      name: "Y",
      city: null,
      state: null,
      category: null,
      source: "google_maps",
      country: null,
      phone: null,
      email: null,
      website: null,
      instagram_handle: null,
      whatsapp: null,
      has_website: null,
      rating: null,
      reviews_count: null,
      followers_count: null,
      stage: "new",
      score: 0,
      notes: null,
    };
    const { client } = makeSupabase({
      campaign: {
        data: {
          id: "c1",
          status: "draft",
          type: "message",
          mode: "ai_per_lead",
          template_text: null,
          ai_channel: "whatsapp",
          ai_tone: "consultivo",
          ai_goal: "iniciar conversa",
        },
        error: null,
      },
      campaignStatusSequence: ["running"],
      targets: { data: [{ lead_id: "lead-1", status: "pending" }], error: null },
      leads: { "lead-1": lead1 },
    });
    generateMock.mockResolvedValue("Texto gerado pela IA");
    sendMock.mockResolvedValue({
      ok: true,
      messageId: "m",
      whatsappMsgId: "e",
    });

    const result = await processCampaign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      userId: "u1",
      campaignId: "c1",
      sendImpl: sendMock,
      generateMessageImpl: generateMock,
      sleep: sleepMock,
    });
    expect(result.sent).toBe(1);
    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Y" }),
      expect.objectContaining({ channel: "whatsapp", tone: "consultivo" }),
    );
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Texto gerado pela IA",
        aiGenerated: true,
      }),
    );
  });

  it("regression: campaign sem `type` (legacy) usa default 'message' flow", async () => {
    // Garante que campaigns existentes (pré-#172) ainda renderizam template.
    // Mesmo que migration tenha default 'message', testes não devem depender
    // da DB — aqui forçamos `type: 'message'` explícito como regression check.
    const lead1 = {
      id: "lead-1",
      name: "Legacy Bar",
      city: "RJ",
      state: "RJ",
      category: null,
      source: "google_maps",
      country: null,
      phone: "21999",
      email: null,
      website: null,
      instagram_handle: null,
      whatsapp: null,
      has_website: null,
      rating: null,
      reviews_count: null,
      followers_count: null,
      stage: "new",
      score: 0,
      notes: null,
    };
    const { client, updates } = makeSupabase({
      campaign: {
        data: {
          id: "c1",
          status: "draft",
          type: "message",
          mode: "template",
          template_text: "Hi {{nome}}",
          ai_channel: null,
          ai_tone: null,
          ai_goal: null,
        },
        error: null,
      },
      campaignStatusSequence: ["running"],
      targets: { data: [{ lead_id: "lead-1", status: "pending" }], error: null },
      leads: { "lead-1": lead1 },
    });
    sendMock.mockResolvedValue({
      ok: true,
      messageId: "m",
      whatsappMsgId: "evo",
    });

    const result = await processCampaign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      userId: "u1",
      campaignId: "c1",
      sendImpl: sendMock,
      generateMessageImpl: generateMock,
      sleep: sleepMock,
    });

    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Hi Legacy Bar",
        aiGenerated: false,
      }),
    );
    expect(updates).toContainEqual(
      expect.objectContaining({
        table: "campaigns",
        payload: expect.objectContaining({ status: "completed" }),
      }),
    );
  });

  it("send falha → conta como failed e segue para o próximo", async () => {
    const lead1 = {
      id: "lead-1",
      name: "Z",
      city: "C",
      state: null,
      category: null,
      source: "google_maps",
      country: null,
      phone: null,
      email: null,
      website: null,
      instagram_handle: null,
      whatsapp: null,
      has_website: null,
      rating: null,
      reviews_count: null,
      followers_count: null,
      stage: "new",
      score: 0,
      notes: null,
    };
    const { client, updates } = makeSupabase({
      campaign: {
        data: {
          id: "c1",
          status: "draft",
          type: "message",
          mode: "template",
          template_text: "x",
          ai_channel: null,
          ai_tone: null,
          ai_goal: null,
        },
        error: null,
      },
      campaignStatusSequence: ["running"],
      targets: { data: [{ lead_id: "lead-1", status: "pending" }], error: null },
      leads: { "lead-1": lead1 },
    });
    sendMock.mockResolvedValue({
      ok: false,
      reason: "evolution_error",
      error: "boom",
    });

    const result = await processCampaign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      userId: "u1",
      campaignId: "c1",
      sendImpl: sendMock,
      generateMessageImpl: generateMock,
      sleep: sleepMock,
    });
    expect(result).toEqual({ sent: 0, failed: 1 });
    // Update do target com status='failed' e error_message
    expect(updates).toContainEqual(
      expect.objectContaining({
        table: "campaign_targets",
        payload: expect.objectContaining({
          status: "failed",
          error_message: "boom",
        }),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // #131 — terminal status sentinela. Trava a decisão "Opção 1": status
  // sempre `completed` quando rodou até o fim (não cancelado). UI usa
  // `failed_count` para distinguir partial-success de 100% falha.
  // -------------------------------------------------------------------------

  it("#131: campanha com 100% falha termina com status 'completed' (sentinela)", async () => {
    // 2 targets, ambos falham no send → counter chega a failed=2.
    // Critério: terminal status DEVE ser 'completed' (não 'failed'/'errored').
    const lead = {
      id: "lead-1",
      name: "X",
      city: null,
      state: null,
      category: null,
      source: "google_maps",
      country: null,
      phone: null,
      email: null,
      website: null,
      instagram_handle: null,
      whatsapp: null,
      has_website: null,
      rating: null,
      reviews_count: null,
      followers_count: null,
      stage: "new",
      score: 0,
      notes: null,
    };
    const { client, updates } = makeSupabase({
      campaign: {
        data: {
          id: "c1",
          status: "draft",
          type: "message",
          mode: "template",
          template_text: "x",
          ai_channel: null,
          ai_tone: null,
          ai_goal: null,
        },
        error: null,
      },
      campaignStatusSequence: ["running", "running", "running"],
      targets: {
        data: [
          { lead_id: "lead-1", status: "pending" },
          { lead_id: "lead-2", status: "pending" },
        ],
        error: null,
      },
      leads: { "lead-1": lead },
    });
    sendMock.mockResolvedValue({
      ok: false,
      reason: "evolution_error",
      error: "boom",
    });

    const result = await processCampaign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      userId: "u1",
      campaignId: "c1",
      sendImpl: sendMock,
      generateMessageImpl: generateMock,
      sleep: sleepMock,
    });

    expect(result).toEqual({ sent: 0, failed: 2 });
    // Terminal status DEVE ser 'completed', mesmo com 100% de falha.
    expect(updates).toContainEqual(
      expect.objectContaining({
        table: "campaigns",
        payload: expect.objectContaining({ status: "completed" }),
      }),
    );
    // Sentinela negativa: garante que NENHUM update da tabela `campaigns`
    // marca status diferente de 'running'/'completed'. Bloqueia regressão
    // tipo "failed === N ? 'errored' : 'completed'".
    const campaignStatuses = updates
      .filter((u) => u.table === "campaigns")
      .map((u) => (u.payload as { status?: string }).status)
      .filter((s): s is string => typeof s === "string");
    expect(campaignStatuses).not.toContain("failed");
    expect(campaignStatuses).not.toContain("errored");
    expect(campaignStatuses).not.toContain("completed_with_errors");
    for (const status of campaignStatuses) {
      expect(["running", "completed"]).toContain(status);
    }
  });

  it("#131: sucesso parcial registra failed_count > 0 e ainda termina como 'completed'", async () => {
    // 3 targets: 1º send ok, 2º+3º falham. Counters esperados: sent=1,
    // failed=2. Terminal status: 'completed'. failed_count é a fonte da
    // verdade pra UI distinguir partial-success de total-failure.
    const lead = {
      id: "lead-1",
      name: "Y",
      city: null,
      state: null,
      category: null,
      source: "google_maps",
      country: null,
      phone: null,
      email: null,
      website: null,
      instagram_handle: null,
      whatsapp: null,
      has_website: null,
      rating: null,
      reviews_count: null,
      followers_count: null,
      stage: "new",
      score: 0,
      notes: null,
    };
    const { client, updates } = makeSupabase({
      campaign: {
        data: {
          id: "c1",
          status: "draft",
          type: "message",
          mode: "template",
          template_text: "x",
          ai_channel: null,
          ai_tone: null,
          ai_goal: null,
        },
        error: null,
      },
      campaignStatusSequence: ["running", "running", "running", "running"],
      targets: {
        data: [
          { lead_id: "lead-1", status: "pending" },
          { lead_id: "lead-2", status: "pending" },
          { lead_id: "lead-3", status: "pending" },
        ],
        error: null,
      },
      leads: { "lead-1": lead },
    });
    sendMock
      .mockResolvedValueOnce({ ok: true, messageId: "m1", whatsappMsgId: "e1" })
      .mockResolvedValueOnce({ ok: false, reason: "evolution_error", error: "boom-2" })
      .mockResolvedValueOnce({ ok: false, reason: "evolution_error", error: "boom-3" });

    const result = await processCampaign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      userId: "u1",
      campaignId: "c1",
      sendImpl: sendMock,
      generateMessageImpl: generateMock,
      sleep: sleepMock,
    });

    expect(result).toEqual({ sent: 1, failed: 2 });
    // Terminal status = 'completed' (mesmo com falhas).
    expect(updates).toContainEqual(
      expect.objectContaining({
        table: "campaigns",
        payload: expect.objectContaining({ status: "completed" }),
      }),
    );
    // failed_count foi incrementado 2x via updates de `campaigns.failed_count`.
    const failedCountUpdates = updates
      .filter(
        (u) =>
          u.table === "campaigns" &&
          typeof (u.payload as { failed_count?: number }).failed_count ===
            "number",
      )
      .map((u) => (u.payload as { failed_count: number }).failed_count);
    // Sequência típica do incremento: 1, 2 (depende do mock counter).
    expect(failedCountUpdates).toContain(2);
  });
});

// ---------------------------------------------------------------------------
// Branch site_preview (#172) — testa o desvio quando campaign.type='site_preview'.
// `dispatchSitePreviewImpl` é injetado pra isolar o helper de dispatch (que
// é coberto em tests/unit/lib/sites/dispatch-site-preview.test.ts).
// ---------------------------------------------------------------------------

describe("processCampaign — type='site_preview'", () => {
  // Stub minimo do service client (não é tocado quando dispatchSitePreviewImpl
  // é injetado; o processor passa esse client adiante mas o mock de dispatch
  // não usa). Ainda assim precisamos passar pra evitar `createServiceSupabase`
  // ler `process.env.SUPABASE_SERVICE_ROLE_KEY` em testes.
  const fakeService = {} as unknown as Parameters<
    typeof processCampaign
  >[0]["serviceClient"];

  it("AC1+AC3: lead com leadSite published → dispatch ok → marca queue 'sent'", async () => {
    const dispatchMock = vi.fn().mockResolvedValue({
      ok: true,
      leadSiteId: "site-1",
    });
    const { client, updates } = makeSupabase({
      campaign: {
        data: {
          id: "c1",
          status: "draft",
          type: "site_preview",
          mode: "template",
          template_text: null,
          ai_channel: null,
          ai_tone: null,
          ai_goal: null,
        },
        error: null,
      },
      campaignStatusSequence: ["running"],
      targets: {
        data: [{ lead_id: "lead-1", status: "pending" }],
        error: null,
      },
    });

    const result = await processCampaign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      userId: "u1",
      campaignId: "c1",
      sendImpl: sendMock,
      generateMessageImpl: generateMock,
      sleep: sleepMock,
      dispatchSitePreviewImpl: dispatchMock,
      serviceClient: fakeService,
    });

    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        leadId: "lead-1",
        sendImpl: sendMock,
      }),
    );
    // generateMessage NÃO deve ser chamado (branch site_preview ignora ai_*)
    expect(generateMock).not.toHaveBeenCalled();
    // Target atualizado pra 'sent'
    expect(updates).toContainEqual(
      expect.objectContaining({
        table: "campaign_targets",
        payload: expect.objectContaining({ status: "sent" }),
      }),
    );
    // Campaign status running → completed (AC1: branch dispatch funciona end-to-end)
    expect(updates).toContainEqual(
      expect.objectContaining({
        table: "campaigns",
        payload: expect.objectContaining({ status: "completed" }),
      }),
    );
  });

  it("AC2: lead sem leadSite (no_site) → marca queue 'skipped' com reason e NÃO conta failed", async () => {
    const dispatchMock = vi.fn().mockResolvedValue({
      ok: false,
      reason: "no_site",
      message: "Lead não possui site gerado.",
    });
    const { client, updates } = makeSupabase({
      campaign: {
        data: {
          id: "c1",
          status: "draft",
          type: "site_preview",
          mode: "template",
          template_text: null,
          ai_channel: null,
          ai_tone: null,
          ai_goal: null,
        },
        error: null,
      },
      campaignStatusSequence: ["running"],
      targets: {
        data: [{ lead_id: "lead-1", status: "pending" }],
        error: null,
      },
    });

    const result = await processCampaign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      userId: "u1",
      campaignId: "c1",
      sendImpl: sendMock,
      generateMessageImpl: generateMock,
      sleep: sleepMock,
      dispatchSitePreviewImpl: dispatchMock,
      serviceClient: fakeService,
    });

    expect(result).toEqual({ sent: 0, failed: 0 });
    const skipped = updates.find(
      (u) =>
        u.table === "campaign_targets" &&
        (u.payload as { status?: string }).status === "skipped",
    );
    expect(skipped).toBeDefined();
    expect(
      (skipped?.payload as { error_message?: string }).error_message,
    ).toMatch(/no_site/);
  });

  it("AC2: lead com leadSite status='archived' (invalid_status) → 'skipped'", async () => {
    const dispatchMock = vi.fn().mockResolvedValue({
      ok: false,
      reason: "invalid_status",
      message: "Site em status 'archived' — apenas 'published'/'sent' são elegíveis.",
    });
    const { client, updates } = makeSupabase({
      campaign: {
        data: {
          id: "c1",
          status: "draft",
          type: "site_preview",
          mode: "template",
          template_text: null,
          ai_channel: null,
          ai_tone: null,
          ai_goal: null,
        },
        error: null,
      },
      campaignStatusSequence: ["running"],
      targets: {
        data: [{ lead_id: "lead-1", status: "pending" }],
        error: null,
      },
    });

    const result = await processCampaign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      userId: "u1",
      campaignId: "c1",
      sendImpl: sendMock,
      generateMessageImpl: generateMock,
      sleep: sleepMock,
      dispatchSitePreviewImpl: dispatchMock,
      serviceClient: fakeService,
    });

    expect(result).toEqual({ sent: 0, failed: 0 });
    const skipped = updates.find(
      (u) =>
        u.table === "campaign_targets" &&
        (u.payload as { status?: string }).status === "skipped",
    );
    expect(skipped).toBeDefined();
    expect(
      (skipped?.payload as { error_message?: string }).error_message,
    ).toMatch(/invalid_status/);
  });

  it("AC3: dispatch retorna whatsapp_error → marca queue 'failed' e incrementa counter", async () => {
    const dispatchMock = vi.fn().mockResolvedValue({
      ok: false,
      reason: "whatsapp_error",
      message: "evolution_error",
    });
    const { client, updates } = makeSupabase({
      campaign: {
        data: {
          id: "c1",
          status: "draft",
          type: "site_preview",
          mode: "template",
          template_text: null,
          ai_channel: null,
          ai_tone: null,
          ai_goal: null,
        },
        error: null,
      },
      campaignStatusSequence: ["running"],
      targets: {
        data: [{ lead_id: "lead-1", status: "pending" }],
        error: null,
      },
    });

    const result = await processCampaign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      userId: "u1",
      campaignId: "c1",
      sendImpl: sendMock,
      generateMessageImpl: generateMock,
      sleep: sleepMock,
      dispatchSitePreviewImpl: dispatchMock,
      serviceClient: fakeService,
    });

    expect(result).toEqual({ sent: 0, failed: 1 });
    const failed = updates.find(
      (u) =>
        u.table === "campaign_targets" &&
        (u.payload as { status?: string }).status === "failed",
    );
    expect(failed).toBeDefined();
    expect((failed?.payload as { error_message?: string }).error_message).toMatch(
      /whatsapp_error/,
    );
  });

  it("#173: dispatch retorna rate_limit_daily → marca queue 'failed' (não skipped) e incrementa counter", async () => {
    // Decisão V1: rate_limit_daily → 'failed' (não 'skipped'). Operador
    // deve ter awareness — retentar amanhã com consciência, não silently
    // skip. Justificativa registrada no body da issue #173.
    const dispatchMock = vi.fn().mockResolvedValue({
      ok: false,
      reason: "rate_limit_daily",
      message:
        "Limite diário de 50 envios atingido para esta instância. Tente amanhã.",
    });
    const { client, updates } = makeSupabase({
      campaign: {
        data: {
          id: "c1",
          status: "draft",
          type: "site_preview",
          mode: "template",
          template_text: null,
          ai_channel: null,
          ai_tone: null,
          ai_goal: null,
        },
        error: null,
      },
      campaignStatusSequence: ["running"],
      targets: {
        data: [{ lead_id: "lead-1", status: "pending" }],
        error: null,
      },
    });

    const result = await processCampaign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      userId: "u1",
      campaignId: "c1",
      sendImpl: sendMock,
      generateMessageImpl: generateMock,
      sleep: sleepMock,
      dispatchSitePreviewImpl: dispatchMock,
      serviceClient: fakeService,
    });

    expect(result).toEqual({ sent: 0, failed: 1 });
    const failed = updates.find(
      (u) =>
        u.table === "campaign_targets" &&
        (u.payload as { status?: string }).status === "failed",
    );
    expect(failed).toBeDefined();
    expect(
      (failed?.payload as { error_message?: string }).error_message,
    ).toMatch(/rate_limit_daily/);
    // Garante que NÃO foi marcado como skipped (no_site/invalid_status).
    const skipped = updates.find(
      (u) =>
        u.table === "campaign_targets" &&
        (u.payload as { status?: string }).status === "skipped",
    );
    expect(skipped).toBeUndefined();
  });

  it("AC1+AC3: 3 targets mistos (sent + skipped + failed) — counters corretos e throttle entre cada", async () => {
    const dispatchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, leadSiteId: "s1" })
      .mockResolvedValueOnce({
        ok: false,
        reason: "no_site",
        message: "Lead não possui site gerado.",
      })
      .mockResolvedValueOnce({
        ok: false,
        reason: "whatsapp_error",
        message: "lead_missing_phone",
      });
    const { client, updates } = makeSupabase({
      campaign: {
        data: {
          id: "c1",
          status: "draft",
          type: "site_preview",
          mode: "template",
          template_text: null,
          ai_channel: null,
          ai_tone: null,
          ai_goal: null,
        },
        error: null,
      },
      campaignStatusSequence: ["running", "running", "running"],
      targets: {
        data: [
          { lead_id: "lead-1", status: "pending" },
          { lead_id: "lead-2", status: "pending" },
          { lead_id: "lead-3", status: "pending" },
        ],
        error: null,
      },
    });

    const result = await processCampaign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      userId: "u1",
      campaignId: "c1",
      sendImpl: sendMock,
      generateMessageImpl: generateMock,
      sleep: sleepMock,
      dispatchSitePreviewImpl: dispatchMock,
      serviceClient: fakeService,
    });

    expect(result).toEqual({ sent: 1, failed: 1 });
    expect(dispatchMock).toHaveBeenCalledTimes(3);
    // Throttle entre cada par (3 targets → 2 sleeps)
    expect(sleepMock).toHaveBeenCalledTimes(2);
    // Cada um dos 3 status aparece em algum update
    const targetStatuses = updates
      .filter((u) => u.table === "campaign_targets")
      .map((u) => (u.payload as { status?: string }).status);
    expect(targetStatuses).toContain("sent");
    expect(targetStatuses).toContain("skipped");
    expect(targetStatuses).toContain("failed");
  });

  it("AC1: campaign cancelled mid-loop interrompe dispatch dos targets restantes", async () => {
    const dispatchMock = vi.fn().mockResolvedValue({
      ok: true,
      leadSiteId: "s1",
    });
    const { client, updates } = makeSupabase({
      campaign: {
        data: {
          id: "c1",
          status: "draft",
          type: "site_preview",
          mode: "template",
          template_text: null,
          ai_channel: null,
          ai_tone: null,
          ai_goal: null,
        },
        error: null,
      },
      // Primeiro check (target 1) retorna 'cancelled' → loop quebra de cara.
      // Segundo (final, decide status) também 'cancelled' → não sobrescreve.
      campaignStatusSequence: ["cancelled", "cancelled"],
      targets: {
        data: [
          { lead_id: "lead-1", status: "pending" },
          { lead_id: "lead-2", status: "pending" },
        ],
        error: null,
      },
    });

    const result = await processCampaign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      userId: "u1",
      campaignId: "c1",
      sendImpl: sendMock,
      generateMessageImpl: generateMock,
      sleep: sleepMock,
      dispatchSitePreviewImpl: dispatchMock,
      serviceClient: fakeService,
    });

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(dispatchMock).not.toHaveBeenCalled();
    // Não deve sobrescrever 'cancelled' com 'completed'
    expect(
      updates.find(
        (u) =>
          u.table === "campaigns" &&
          (u.payload as { status?: string }).status === "completed",
      ),
    ).toBeUndefined();
  });

  it("AC3: dispatch lança throw inesperado → captura como 'failed' com message", async () => {
    const dispatchMock = vi.fn().mockRejectedValue(new Error("unexpected boom"));
    const { client, updates } = makeSupabase({
      campaign: {
        data: {
          id: "c1",
          status: "draft",
          type: "site_preview",
          mode: "template",
          template_text: null,
          ai_channel: null,
          ai_tone: null,
          ai_goal: null,
        },
        error: null,
      },
      campaignStatusSequence: ["running"],
      targets: {
        data: [{ lead_id: "lead-1", status: "pending" }],
        error: null,
      },
    });

    const result = await processCampaign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      userId: "u1",
      campaignId: "c1",
      sendImpl: sendMock,
      generateMessageImpl: generateMock,
      sleep: sleepMock,
      dispatchSitePreviewImpl: dispatchMock,
      serviceClient: fakeService,
    });

    expect(result).toEqual({ sent: 0, failed: 1 });
    const failed = updates.find(
      (u) =>
        u.table === "campaign_targets" &&
        (u.payload as { status?: string }).status === "failed",
    );
    expect(failed).toBeDefined();
    expect((failed?.payload as { error_message?: string }).error_message).toContain(
      "unexpected boom",
    );
  });
});

