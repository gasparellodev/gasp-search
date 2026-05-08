import { describe, expect, it, vi } from "vitest";
import { listLeadMessages } from "@/lib/ai/messages";

type ChainResult = {
  data: unknown;
  count: number | null;
  error: { message: string } | null;
};

function createSupabaseMock(result: ChainResult) {
  const range = vi.fn<(from: number, to: number) => Promise<ChainResult>>(
    async () => result,
  );
  const order = vi.fn<(column: string, opts: { ascending: boolean }) => {
    range: typeof range;
  }>(() => ({ range }));
  const eq = vi.fn<(column: string, value: string) => { order: typeof order }>(
    () => ({ order }),
  );
  const select = vi.fn<(query: string, opts?: { count: "exact" }) => {
    eq: typeof eq;
  }>(() => ({ eq }));
  const from = vi.fn<(table: string) => { select: typeof select }>(() => ({
    select,
  }));

  return {
    client: { from } as unknown as Parameters<
      typeof listLeadMessages
    >[0]["supabase"],
    spies: { from, select, eq, order, range },
  };
}

describe("listLeadMessages", () => {
  it("lista mensagens do lead ordenadas desc com paginação e total", async () => {
    const { client, spies } = createSupabaseMock({
      data: [
        {
          id: "message-2",
          lead_id: "lead-1",
          channel: "whatsapp",
          tone: "direto",
          content: "Segunda mensagem",
          created_at: "2026-05-07T12:02:00Z",
          direction: "outbound",
          status: "sent",
          whatsapp_msg_id: "evo-2",
          campaign_id: null,
          ai_generated: true,
          error_message: null,
        },
      ],
      count: 41,
      error: null,
    });

    const result = await listLeadMessages({
      supabase: client,
      leadId: "lead-1",
      page: 2,
    });

    expect(spies.from).toHaveBeenCalledWith("lead_messages");
    expect(spies.select).toHaveBeenCalledWith(
      "id, lead_id, channel, tone, content, created_at, direction, status, whatsapp_msg_id, campaign_id, ai_generated, error_message",
      { count: "exact" },
    );
    expect(spies.eq).toHaveBeenCalledWith("lead_id", "lead-1");
    expect(spies.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(spies.range).toHaveBeenCalledWith(20, 39);
    expect(result).toMatchObject({
      totalCount: 41,
      page: 2,
      pageSize: 20,
      totalPages: 3,
      messages: [
        {
          id: "message-2",
          content: "Segunda mensagem",
          direction: "outbound",
          status: "sent",
          whatsapp_msg_id: "evo-2",
          ai_generated: true,
          campaign_id: null,
        },
      ],
    });
  });

  it("normaliza página inválida para 1 e retorna totalPages 0 sem resultados", async () => {
    const { client, spies } = createSupabaseMock({
      data: null,
      count: null,
      error: null,
    });

    const result = await listLeadMessages({
      supabase: client,
      leadId: "lead-1",
      page: 0,
    });

    expect(spies.range).toHaveBeenCalledWith(0, 19);
    expect(result.messages).toEqual([]);
    expect(result.totalPages).toBe(0);
  });

  it("lança erro quando Supabase falha", async () => {
    const { client } = createSupabaseMock({
      data: null,
      count: null,
      error: { message: "rls" },
    });

    await expect(
      listLeadMessages({ supabase: client, leadId: "lead-1" }),
    ).rejects.toThrow(/Falha ao listar mensagens/);
  });
});
