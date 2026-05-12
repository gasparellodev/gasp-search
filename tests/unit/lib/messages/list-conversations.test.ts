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

  const orderFn = vi.fn(async () => opts.messagesResult);
  const orFn = vi.fn(() => ({ order: orderFn }));
  const messagesQueryBuilder = {
    select: vi.fn(() => ({ or: orFn })),
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

  return {
    client: { from } as unknown as Parameters<typeof listConversations>[0],
    spies: { orFn },
  };
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

  it("thread de lead removido não aparece em listConversations (após cascade DELETE)", async () => {
    // Pós-#133 / migration 0023: lead_messages.lead_id tem ON DELETE CASCADE.
    // Deletar um lead remove suas mensagens automaticamente no DB; o helper
    // não precisa mais filtrar orphans defensivamente.
    //
    // Mock simula o estado pós-cascade: o SELECT de lead_messages já não
    // retorna nada do lead deletado (o DB removeu via cascade). Apenas leads
    // vivos aparecem.
    const { client } = makeSupabase({
      messagesResult: {
        data: [
          {
            lead_id: "lead-vivo",
            content: "ainda aqui",
            created_at: "2026-05-09T12:00:00Z",
            direction: "outbound",
            status: "sent",
          },
          // Note: nenhuma row de 'lead-deletado' — cascade já apagou no DB.
        ],
        error: null,
      },
      leadsResult: {
        data: [
          { id: "lead-vivo", name: "Vivo", phone: null, whatsapp: null },
        ],
        error: null,
      },
    });
    const result = await listConversations(client);
    expect(result).toHaveLength(1);
    expect(result[0]?.leadId).toBe("lead-vivo");
    expect(result.find((r) => r.leadId === "lead-deletado")).toBeUndefined();
  });

  it("se a invariante quebrar (race entre selects), expõe thread como 'Lead removido' em vez de filtrar silenciosamente", async () => {
    // Defesa em profundidade pós-#133. A invariante DB (cascade FK) deveria
    // tornar este caso impossível, mas em runtime concorrente é possível um
    // delete acontecer ENTRE os dois selects do helper. Antes, `.filter(x =>
    // x !== null)` simplesmente escondia a thread. Agora a thread aparece
    // com placeholder para não silenciar histórico.
    const { client } = makeSupabase({
      messagesResult: {
        data: [
          {
            lead_id: "race-deleted",
            content: "msg que sobrou no SELECT",
            created_at: "2026-05-09T12:00:00Z",
            direction: "inbound",
            status: "delivered",
          },
        ],
        error: null,
      },
      // leads SELECT roda depois e não acha o lead — cenário de race.
      leadsResult: { data: [], error: null },
    });
    const result = await listConversations(client);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      leadId: "race-deleted",
      leadName: "Lead removido",
      leadPhone: null,
      lastContent: "msg que sobrou no SELECT",
    });
  });

  it("propaga erro do select de mensagens", async () => {
    const { client } = makeSupabase({
      messagesResult: { data: null, error: { message: "rls" } },
      leadsResult: { data: [], error: null },
    });
    await expect(listConversations(client)).rejects.toThrow(/rls/);
  });

  it("aplica filtro de mensagens reais (inbound OR outbound enviado)", async () => {
    const { client, spies } = makeSupabase({
      messagesResult: { data: [], error: null },
      leadsResult: { data: [], error: null },
    });
    await listConversations(client);
    expect(spies.orFn).toHaveBeenCalledWith(
      "direction.eq.inbound,whatsapp_msg_id.not.is.null",
    );
  });
});
