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
              if (cols === "sent_count" || cols === "failed_count") {
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
});
