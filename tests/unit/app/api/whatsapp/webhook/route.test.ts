import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    EVOLUTION_API_URL: "http://x",
    EVOLUTION_API_KEY: "k",
    EVOLUTION_WEBHOOK_SECRET: "topsecret123456789",
  },
}));

const serviceMocks = vi.hoisted(() => ({
  client: null as unknown,
  createServiceSupabase: vi.fn(),
}));

const presenceMocks = vi.hoisted(() => ({
  setLeadPresence: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabase: serviceMocks.createServiceSupabase,
}));

vi.mock("@/lib/whatsapp/presence", () => ({
  setLeadPresence: presenceMocks.setLeadPresence,
}));

function makeBody(payload: Record<string, unknown>): string {
  return JSON.stringify(payload);
}

function sigHeader(body: string, secret = "topsecret123456789") {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function makeReq(body: string, sig: string | null) {
  const headers = new Headers({ "content-type": "application/json" });
  if (sig) headers.set("x-evolution-signature", sig);
  return new Request("http://localhost/api/whatsapp/webhook", {
    method: "POST",
    headers,
    body,
  });
}

type TableHandler = {
  select?: { data: unknown };
  insert?: (payload: unknown) => Promise<{ error: unknown }> | unknown;
  update?: (payload: unknown) => unknown;
};

type TableHandlers = Record<string, TableHandler>;

function makeServiceClient(handlers: TableHandlers) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = [];

  const buildSelect = (data: unknown) => {
    const maybeSingle = vi.fn(async () => ({ data, error: null }));
    return {
      eq: vi.fn(() => ({
        maybeSingle,
        // simula thenable para `await from(...).select().eq(...)`
        then: (resolve: (value: { data: unknown; error: null }) => void) =>
          resolve({ data, error: null }),
      })),
    };
  };

  const from = vi.fn((table: string) => {
    const t: TableHandler = handlers[table] ?? {};
    return {
      select: () => buildSelect(t.select?.data ?? null),
      update: vi.fn((payload: unknown) => {
        // Supabase `.update(...).eq(...).eq(...)` é chainable até o await:
        // o builder retornado por `.update()` precisa expor `.eq()` que
        // devolve ele mesmo, e só ao await registramos a chamada (uma vez).
        let recorded = false;
        const builder: {
          eq: (column: string, value: unknown) => typeof builder;
          then: (resolve: (v: { error: null }) => void) => void;
        } = {
          eq() {
            return builder;
          },
          then(resolve) {
            if (!recorded) {
              recorded = true;
              calls.push({ table, op: "update", payload });
              if (t.update) t.update(payload);
            }
            resolve({ error: null });
          },
        };
        return builder;
      }),
      insert: vi.fn(async (payload: unknown) => {
        calls.push({ table, op: "insert", payload });
        if (t.insert) {
          return t.insert(payload);
        }
        return { error: null };
      }),
    };
  });

  return { client: { from }, calls };
}

beforeEach(() => {
  vi.resetModules();
  serviceMocks.createServiceSupabase.mockReset();
  presenceMocks.setLeadPresence.mockReset();
  presenceMocks.setLeadPresence.mockResolvedValue({
    presence: "typing",
    lastSeen: "2026-05-12T12:00:00.000Z",
  });
});

describe("POST /api/whatsapp/webhook", () => {
  it("retorna 401 sem assinatura quando instância não está cadastrada", async () => {
    const body = makeBody({
      event: "connection.update",
      instance: "ghost_instance",
      data: { state: "open" },
    });
    const { client } = makeServiceClient({
      whatsapp_instances: { select: { data: null } },
    });
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, null));
    expect(res.status).toBe(401);
  });

  it("retorna 401 com assinatura inválida", async () => {
    const body = makeBody({});
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, "0".repeat(64)));
    expect(res.status).toBe(401);
  });

  it("aceita sem assinatura quando instância está cadastrada (Evolution v2 compat)", async () => {
    const body = makeBody({
      event: "connection.update",
      instance: "user_aabbccdd",
      data: { state: "open", owner: "5511999998888@s.whatsapp.net" },
    });
    const { client, calls } = makeServiceClient({
      whatsapp_instances: {
        select: { data: { user_id: "u1", status: "qr_pending" } },
      },
    });
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, null));
    expect(res.status).toBe(200);
    expect(calls).toContainEqual(
      expect.objectContaining({ table: "whatsapp_instances", op: "update" }),
    );
  });

  it("retorna 400 em JSON inválido com sig válida", async () => {
    const body = "not-json";
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, sigHeader(body)));
    expect(res.status).toBe(400);
  });

  it("retorna 200 ok+ignored para evento desconhecido", async () => {
    const body = makeBody({ event: "unknown.event", data: {} });
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, sigHeader(body)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ignored: true });
  });

  it("connection.update atualiza whatsapp_instances", async () => {
    const body = makeBody({
      event: "connection.update",
      instance: "user_aabbccdd",
      data: { state: "open", owner: "5511999998888@s.whatsapp.net" },
    });
    const { client, calls } = makeServiceClient({
      whatsapp_instances: {
        select: { data: { user_id: "u1", status: "qr_pending" } },
      },
    });
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, sigHeader(body)));
    expect(res.status).toBe(200);
    expect(calls).toContainEqual(
      expect.objectContaining({
        table: "whatsapp_instances",
        op: "update",
        payload: expect.objectContaining({
          status: "connected",
          phone_number: "5511999998888",
        }),
      }),
    );
  });

  it("message.status atualiza lead_messages pelo whatsapp_msg_id", async () => {
    const body = makeBody({
      event: "messages.update",
      instance: "user_aabbccdd",
      data: { key: { id: "evo-1" }, status: "READ" },
    });
    const { client, calls } = makeServiceClient({
      whatsapp_instances: {
        select: { data: { user_id: "u1", status: "connected" } },
      },
    });
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, sigHeader(body)));
    expect(res.status).toBe(200);
    expect(calls).toContainEqual(
      expect.objectContaining({
        table: "lead_messages",
        op: "update",
        payload: { status: "read" },
      }),
    );
  });

  it("message.upsert ignora fromMe=true (já gravado pelo send)", async () => {
    const body = makeBody({
      event: "messages.upsert",
      instance: "user_aabbccdd",
      data: {
        key: {
          id: "evo-1",
          remoteJid: "5511999998888@s.whatsapp.net",
          fromMe: true,
        },
        message: { conversation: "olá" },
      },
    });
    const { client, calls } = makeServiceClient({
      whatsapp_instances: {
        select: { data: { user_id: "u1", status: "connected" } },
      },
    });
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, sigHeader(body)));
    expect(res.status).toBe(200);
    // Não deve haver insert em lead_messages
    expect(calls.find((c) => c.table === "lead_messages")).toBeUndefined();
  });

  it("message.upsert inbound: insere lead_messages e promove stage", async () => {
    const body = makeBody({
      event: "messages.upsert",
      instance: "user_aabbccdd",
      data: {
        key: {
          id: "evo-1",
          remoteJid: "5511999998888@s.whatsapp.net",
          fromMe: false,
        },
        message: { conversation: "Tô interessado" },
      },
    });
    const { client, calls } = makeServiceClient({
      whatsapp_instances: {
        select: { data: { user_id: "u1", status: "connected" } },
      },
      leads: {
        select: {
          data: [
            {
              id: "lead-1",
              stage: "contacted",
              phone: "5511999998888",
              whatsapp: null,
            },
          ],
        },
      },
    });
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, sigHeader(body)));
    expect(res.status).toBe(200);
    expect(calls).toContainEqual(
      expect.objectContaining({
        table: "lead_messages",
        op: "insert",
        payload: expect.objectContaining({
          lead_id: "lead-1",
          user_id: "u1",
          channel: "whatsapp",
          content: "Tô interessado",
          direction: "inbound",
          status: "delivered",
          whatsapp_msg_id: "evo-1",
        }),
      }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({
        table: "leads",
        op: "update",
        payload: { stage: "in_conversation" },
      }),
    );
  });

  it("presence.update resolve lead por telefone e grava presença volátil no Redis", async () => {
    const body = makeBody({
      event: "presence.update",
      instance: "user_aabbccdd",
      data: {
        id: "5511999998888@s.whatsapp.net",
        presences: {
          "5511999998888@s.whatsapp.net": {
            lastKnownPresence: "composing",
          },
        },
      },
    });
    const { client } = makeServiceClient({
      whatsapp_instances: {
        select: { data: { user_id: "u1", status: "connected" } },
      },
      leads: {
        select: {
          data: [
            {
              id: "lead-1",
              stage: "contacted",
              phone: "5511999998888",
              whatsapp: null,
            },
          ],
        },
      },
    });
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, sigHeader(body)));

    expect(res.status).toBe(200);
    expect(presenceMocks.setLeadPresence).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        leadId: "lead-1",
        presence: "typing",
      }),
    );
  });

  it("message.upsert: erro de insert com code 23505 (PG unique violation) → 200 silencioso (#138b)", async () => {
    // #138b — trocamos detecção por string match (`includes('duplicate')`)
    // por checagem do PG error code `23505`. Garante que mensagens de erro
    // localizadas / reescritas pelo Postgres não furam o silenciamento da
    // colisão idempotente esperada (UNIQUE em whatsapp_msg_id).
    const body = makeBody({
      event: "messages.upsert",
      instance: "user_aabbccdd",
      data: {
        key: {
          id: "evo-dup",
          remoteJid: "5511999998888@s.whatsapp.net",
          fromMe: false,
        },
        message: { conversation: "duplicate inbound" },
      },
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, calls } = makeServiceClient({
      whatsapp_instances: {
        select: { data: { user_id: "u1", status: "connected" } },
      },
      leads: {
        select: {
          data: [
            {
              id: "lead-1",
              stage: "contacted",
              phone: "5511999998888",
              whatsapp: null,
            },
          ],
        },
      },
      lead_messages: {
        insert: () => ({
          error: {
            code: "23505",
            message: "duplicate key value violates unique constraint",
          },
        }),
      },
    });
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, sigHeader(body)));
    expect(res.status).toBe(200);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(
      calls.find((c) => c.table === "leads" && c.op === "update"),
    ).toBeUndefined();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("message.upsert: erro de insert com code 23505 ainda funciona mesmo se message não tem 'duplicate' (#138b)", async () => {
    // Reforça que a detecção é por CODE, não pela string. Em alguns locales
    // a `message` do Postgres pode estar traduzida e não conter "duplicate".
    const body = makeBody({
      event: "messages.upsert",
      instance: "user_aabbccdd",
      data: {
        key: {
          id: "evo-dup-ptbr",
          remoteJid: "5511999998888@s.whatsapp.net",
          fromMe: false,
        },
        message: { conversation: "ola" },
      },
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = makeServiceClient({
      whatsapp_instances: {
        select: { data: { user_id: "u1", status: "connected" } },
      },
      leads: {
        select: {
          data: [
            {
              id: "lead-1",
              stage: "in_conversation",
              phone: "5511999998888",
              whatsapp: null,
            },
          ],
        },
      },
      lead_messages: {
        insert: () => ({
          error: {
            code: "23505",
            message: "valor duplicado viola restrição de unicidade",
          },
        }),
      },
    });
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, sigHeader(body)));
    expect(res.status).toBe(200);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("message.upsert: erro com outro code PG (23502 not null) → 500 (Evolution retransmite) (#138b)", async () => {
    const body = makeBody({
      event: "messages.upsert",
      instance: "user_aabbccdd",
      data: {
        key: {
          id: "evo-broken",
          remoteJid: "5511999998888@s.whatsapp.net",
          fromMe: false,
        },
        message: { conversation: "oi" },
      },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = makeServiceClient({
      whatsapp_instances: {
        select: { data: { user_id: "u1", status: "connected" } },
      },
      leads: {
        select: {
          data: [
            {
              id: "lead-1",
              stage: "contacted",
              phone: "5511999998888",
              whatsapp: null,
            },
          ],
        },
      },
      lead_messages: {
        insert: () => ({
          error: {
            code: "23502",
            message: "null value in column violates not-null constraint",
          },
        }),
      },
    });
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, sigHeader(body)));
    expect(res.status).toBe(500);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("message.upsert: ignora se phone não bate com nenhum lead", async () => {
    const body = makeBody({
      event: "messages.upsert",
      instance: "user_aabbccdd",
      data: {
        key: {
          id: "evo-1",
          remoteJid: "5599999999999@s.whatsapp.net",
          fromMe: false,
        },
        message: { conversation: "spam" },
      },
    });
    const { client, calls } = makeServiceClient({
      whatsapp_instances: {
        select: { data: { user_id: "u1", status: "connected" } },
      },
      leads: { select: { data: [] } },
    });
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { POST } = await import("@/app/api/whatsapp/webhook/route");
      const res = await POST(makeReq(body, sigHeader(body)));
      expect(res.status).toBe(200);
      expect(calls.find((c) => c.table === "lead_messages")).toBeUndefined();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("message.upsert: inbound sem match emite log estruturado com remoteJid + instance", async () => {
    // #133: até agora um inbound vindo de número que não bate com nenhum
    // lead era dropado em silêncio. Para auditoria precisamos de log
    // estruturado com `remoteJid`, `instance` e `reason: 'no_matching_lead'`.
    const body = makeBody({
      event: "messages.upsert",
      instance: "user_aabbccdd",
      data: {
        key: {
          id: "evo-1",
          remoteJid: "5599999999999@s.whatsapp.net",
          fromMe: false,
        },
        message: { conversation: "spam" },
      },
    });
    const { client } = makeServiceClient({
      whatsapp_instances: {
        select: { data: { user_id: "u1", status: "connected" } },
      },
      leads: { select: { data: [] } },
    });
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { POST } = await import("@/app/api/whatsapp/webhook/route");
      const res = await POST(makeReq(body, sigHeader(body)));
      expect(res.status).toBe(200);
      // Procura um console.warn cujo argumento (string JSON) contém todos os
      // campos esperados. Aceita JSON ou objeto direto.
      const matched = warnSpy.mock.calls.some((args) => {
        const first = args[0];
        let parsed: unknown = first;
        if (typeof first === "string") {
          try {
            parsed = JSON.parse(first);
          } catch {
            return false;
          }
        }
        if (!parsed || typeof parsed !== "object") return false;
        const p = parsed as Record<string, unknown>;
        return (
          p.route === "POST /api/whatsapp/webhook" &&
          p.event === "inbound_dropped" &&
          p.reason === "no_matching_lead" &&
          // O remoteJid pode vir cru ("5599999999999@s.whatsapp.net") ou
          // normalizado ("5599999999999"). Aceitamos os dois — o importante
          // é que o número apareça pra correlacionar com Evolution logs.
          typeof p.remoteJid === "string" &&
          (p.remoteJid as string).includes("5599999999999") &&
          p.instance === "user_aabbccdd"
        );
      });
      expect(matched).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
