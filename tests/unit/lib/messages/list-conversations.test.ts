import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { EVOLUTION_API_URL: "http://x", EVOLUTION_API_KEY: "k" },
}));

const { listConversations } = await import("@/lib/messages/list-conversations");

type ChainResult = { data: unknown; error: { message: string } | null };

function makeSupabase(opts: {
  messagesResult: ChainResult;
  leadsResult: ChainResult;
}) {
  let leadsCallTarget: ChainResult | null = null;

  const messagesQueryBuilder = {
    select: vi.fn(() => ({
      order: vi.fn(async () => opts.messagesResult),
    })),
  };

  const leadsQueryBuilder = {
    select: vi.fn(() => ({
      in: vi.fn(async () => leadsCallTarget ?? opts.leadsResult),
    })),
  };

  const from = vi.fn((table: string) => {
    if (table === "lead_messages") return messagesQueryBuilder;
    if (table === "leads") {
      leadsCallTarget = opts.leadsResult;
      return leadsQueryBuilder;
    }
    throw new Error(`unexpected table ${table}`);
  });

  return { client: { from } as unknown as Parameters<typeof listConversations>[0] };
}

describe("listConversations", () => {
  it("retorna [] quando não há mensagens", async () => {
    const { client } = makeSupabase({
      messagesResult: { data: [], error: null },
      leadsResult: { data: [], error: null },
    });
    const result = await listConversations(client);
    expect(result).toEqual([]);
  });

  it("agrega por lead pegando a última mensagem (ordem desc do select)", async () => {
    const { client } = makeSupabase({
      messagesResult: {
        data: [
          {
            lead_id: "lead-1",
            content: "msg recente lead-1",
            created_at: "2026-05-08T12:00:00Z",
            direction: "outbound",
            status: "sent",
          },
          {
            lead_id: "lead-1",
            content: "msg antiga lead-1",
            created_at: "2026-05-08T10:00:00Z",
            direction: "inbound",
            status: "delivered",
          },
          {
            lead_id: "lead-2",
            content: "única lead-2",
            created_at: "2026-05-08T11:00:00Z",
            direction: "inbound",
            status: "delivered",
          },
        ],
        error: null,
      },
      leadsResult: {
        data: [
          { id: "lead-1", name: "Barbearia A", phone: "5511", whatsapp: null },
          { id: "lead-2", name: "Restaurante B", phone: null, whatsapp: "5522" },
        ],
        error: null,
      },
    });

    const result = await listConversations(client);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      leadId: "lead-1",
      leadName: "Barbearia A",
      lastContent: "msg recente lead-1",
      lastDirection: "outbound",
      lastStatus: "sent",
      leadPhone: "5511",
    });
    expect(result[1]).toMatchObject({
      leadId: "lead-2",
      leadName: "Restaurante B",
      leadPhone: "5522", // whatsapp preferred over phone
    });
  });

  it("ignora messages cujo lead não está mais acessível (RLS / deletado)", async () => {
    const { client } = makeSupabase({
      messagesResult: {
        data: [
          {
            lead_id: "ghost",
            content: "x",
            created_at: "now",
            direction: "outbound",
            status: "sent",
          },
        ],
        error: null,
      },
      leadsResult: { data: [], error: null },
    });
    const result = await listConversations(client);
    expect(result).toEqual([]);
  });

  it("propaga erro do select de mensagens", async () => {
    const { client } = makeSupabase({
      messagesResult: { data: null, error: { message: "rls" } },
      leadsResult: { data: [], error: null },
    });
    await expect(listConversations(client)).rejects.toThrow(/rls/);
  });
});
