import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const aiMocks = vi.hoisted(() => ({
  generateMessage: vi.fn(),
}));

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const MESSAGE_ID = "22222222-2222-4222-8222-222222222222";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/ai/anthropic", () => ({
  generateMessage: aiMocks.generateMessage,
}));

const leadRow = {
  id: LEAD_ID,
  user_id: "user-1",
  source: "google_maps",
  source_search_job_id: "job-1",
  name: "Barbearia Bigode",
  category: "Barbearia",
  city: "São Paulo",
  state: "SP",
  country: "Brasil",
  phone: "+55 11 99999-0000",
  email: "contato@bigode.com.br",
  website: "bigode.com.br",
  instagram_handle: "barbeariabigode",
  whatsapp: null,
  has_website: true,
  rating: 4.7,
  reviews_count: 128,
  followers_count: null,
  stage: "new",
  score: 73,
  notes: null,
  raw: null,
  enriched_at: null,
  created_at: "2026-05-07T00:00:00Z",
  updated_at: "2026-05-07T00:00:00Z",
};

function makePostRequest(body: unknown) {
  return new Request("http://localhost:3000/api/ai/generate-message", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeSupabaseMock({
  lead = leadRow,
  leadError = null,
  message = {
    id: MESSAGE_ID,
    content: "Olá, vi a Barbearia Bigode...",
  },
  messageError = null,
}: {
  lead?: typeof leadRow | null;
  leadError?: { message: string } | null;
  message?: { id: string; content: string } | null;
  messageError?: { message: string } | null;
} = {}) {
  const leadMaybeSingle = vi.fn(() =>
    Promise.resolve({ data: lead, error: leadError }),
  );
  const leadEq = vi.fn(() => ({ maybeSingle: leadMaybeSingle }));
  const leadSelect = vi.fn(() => ({ eq: leadEq }));

  const messageSingle = vi.fn(() =>
    Promise.resolve({ data: message, error: messageError }),
  );
  const messageSelect = vi.fn(() => ({ single: messageSingle }));
  const messageInsert = vi.fn(() => ({ select: messageSelect }));

  const from = vi.fn((table: string) => {
    if (table === "leads") {
      return { select: leadSelect };
    }
    if (table === "lead_messages") {
      return { insert: messageInsert };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    client: { auth: { getUser: supabaseMocks.getUser }, from },
    spies: {
      from,
      leadSelect,
      leadEq,
      leadMaybeSingle,
      messageInsert,
      messageSelect,
      messageSingle,
    },
  };
}

async function importRoute() {
  return import("@/app/api/ai/generate-message/route");
}

beforeEach(() => {
  vi.useRealTimers();
  vi.resetModules();
  aiMocks.generateMessage.mockReset();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
  const supabase = makeSupabaseMock();
  supabaseMocks.createServerSupabase.mockResolvedValue(supabase.client);
});

describe("POST /api/ai/generate-message", () => {
  it("retorna 401 quando não autenticado", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { POST } = await importRoute();
    const response = await POST(
      makePostRequest({
        leadId: LEAD_ID,
        channel: "whatsapp",
        tone: "direto",
      }),
    );

    expect(response.status).toBe(401);
    expect(aiMocks.generateMessage).not.toHaveBeenCalled();
  });

  it("retorna 400 quando body é inválido", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const { POST } = await importRoute();
    const response = await POST(makePostRequest({ channel: "whatsapp" }));

    expect(response.status).toBe(400);
    expect(aiMocks.generateMessage).not.toHaveBeenCalled();
  });

  it("retorna 404 quando RLS bloqueia ou lead não existe", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(
      makeSupabaseMock({ lead: null }).client,
    );

    const { POST } = await importRoute();
    const response = await POST(
      makePostRequest({
        leadId: LEAD_ID,
        channel: "email",
        tone: "consultivo",
      }),
    );

    expect(response.status).toBe(404);
    expect(aiMocks.generateMessage).not.toHaveBeenCalled();
  });

  it("gera mensagem, persiste em lead_messages e retorna content/messageId", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    aiMocks.generateMessage.mockResolvedValue("Olá, vi a Barbearia Bigode...");
    const supabase = makeSupabaseMock();
    supabaseMocks.createServerSupabase.mockResolvedValue(supabase.client);

    const { POST } = await importRoute();
    const response = await POST(
      makePostRequest({
        leadId: LEAD_ID,
        channel: "whatsapp",
        tone: "consultivo",
        goal: "agendar uma conversa",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      content: "Olá, vi a Barbearia Bigode...",
      messageId: MESSAGE_ID,
    });
    expect(supabase.spies.leadSelect).toHaveBeenCalledWith(
      expect.stringContaining("name"),
    );
    expect(supabase.spies.leadSelect).toHaveBeenCalledWith(
      expect.not.stringContaining("raw"),
    );
    expect(supabase.spies.leadEq).toHaveBeenCalledWith("id", LEAD_ID);
    expect(aiMocks.generateMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Barbearia Bigode",
        website: "bigode.com.br",
        instagram_handle: "barbeariabigode",
      }),
      {
        channel: "whatsapp",
        tone: "consultivo",
        goal: "agendar uma conversa",
      },
    );
    expect(supabase.spies.messageInsert).toHaveBeenCalledWith({
      lead_id: LEAD_ID,
      user_id: "user-1",
      channel: "whatsapp",
      tone: "consultivo",
      content: "Olá, vi a Barbearia Bigode...",
    });
  });

  it("aplica rate limit básico de uma chamada por segundo por usuário", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-07T12:00:00Z"));
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    aiMocks.generateMessage.mockResolvedValue("Mensagem");

    const { POST } = await importRoute();
    const body = {
      leadId: LEAD_ID,
      channel: "whatsapp",
      tone: "direto",
    };
    const first = await POST(makePostRequest(body));
    const second = await POST(makePostRequest(body));

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(aiMocks.generateMessage).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-05-07T12:00:01.001Z"));
    const third = await POST(makePostRequest(body));
    expect(third.status).toBe(200);
  });

  it("retorna 502 quando geração ou persistência falha", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    aiMocks.generateMessage.mockRejectedValue(new Error("anthropic fora"));

    const { POST } = await importRoute();
    const response = await POST(
      makePostRequest({
        leadId: LEAD_ID,
        channel: "email",
        tone: "direto",
      }),
    );

    expect(response.status).toBe(502);
  });
});
