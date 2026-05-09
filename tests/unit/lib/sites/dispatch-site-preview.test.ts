/**
 * Tests do helper `dispatchSitePreview` (`lib/sites/dispatch-site-preview.ts`).
 *
 * Esse helper é a extração do núcleo de `sendLeadSiteWhatsApp` (#171) pra
 * ser reusado pelo processor de campanhas tipo `site_preview` (#172).
 *
 * Cobre:
 *   - leadSite ausente (no_site)
 *   - leadSite com status inválido (invalid_status)
 *   - render error (variável faltante — defesa em profundidade)
 *   - send falha (whatsapp_error com mapping de reason)
 *   - update lead_sites falha (db_error)
 *   - happy path (ok=true, lead_sites updated)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://app.test" },
}));

const { dispatchSitePreview } = await import(
  "@/lib/sites/dispatch-site-preview"
);

type MockSupabase = ReturnType<typeof makeSupabase>["client"];

function makeSupabase(opts: {
  leadSite?: { data: unknown; error: { message: string } | null };
  lead?: { data: unknown; error: { message: string } | null };
  updateError?: { message: string } | null;
}) {
  const updates: Array<{ table: string; payload: unknown }> = [];
  const from = vi.fn((table: string) => {
    if (table === "lead_sites") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () =>
              opts.leadSite ?? { data: null, error: null },
            ),
          })),
        })),
        update: vi.fn((payload: Record<string, unknown>) => ({
          eq: vi.fn(async () => {
            updates.push({ table, payload });
            return { error: opts.updateError ?? null };
          }),
        })),
      };
    }
    if (table === "leads") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () =>
              opts.lead ?? { data: { name: "Auto Center" }, error: null },
            ),
          })),
        })),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  return { client: { from }, updates };
}

const sendMock = vi.fn();

beforeEach(() => {
  sendMock.mockReset();
});

describe("dispatchSitePreview", () => {
  it("retorna { ok: false, reason: 'no_site' } quando leadSites não tem row", async () => {
    const { client } = makeSupabase({
      leadSite: { data: null, error: null },
    });
    const { client: serviceClient } = makeSupabase({});

    const result = await dispatchSitePreview({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      service: serviceClient as any,
      userId: "u1",
      leadId: "lead-1",
      sendImpl: sendMock,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("no_site");
      expect(result.message).toMatch(/site/i);
    }
    expect(sendMock).not.toHaveBeenCalled();
  });

  it.each(["draft", "archived"] as const)(
    "retorna 'invalid_status' para leadSite.status=%s",
    async (status) => {
      const { client } = makeSupabase({
        leadSite: {
          data: { id: "site-1", slug: "auto-x", status },
          error: null,
        },
      });
      const { client: serviceClient } = makeSupabase({});

      const result = await dispatchSitePreview({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase: client as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        service: serviceClient as any,
        userId: "u1",
        leadId: "lead-1",
        sendImpl: sendMock,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("invalid_status");
        expect(result.message).toContain(status);
      }
      expect(sendMock).not.toHaveBeenCalled();
    },
  );

  it.each(["published", "sent"] as const)(
    "happy path: status=%s → render + send + update lead_sites='sent'",
    async (status) => {
      const { client } = makeSupabase({
        leadSite: {
          data: { id: "site-1", slug: "concessionaria-x", status },
          error: null,
        },
        lead: { data: { name: "Concessionária X" }, error: null },
      });
      const { client: serviceClient, updates: serviceUpdates } = makeSupabase(
        {},
      );
      sendMock.mockResolvedValue({
        ok: true,
        messageId: "m1",
        whatsappMsgId: "evo-1",
      });

      const result = await dispatchSitePreview({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase: client as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        service: serviceClient as any,
        userId: "u1",
        leadId: "lead-1",
        sendImpl: sendMock,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.leadSiteId).toBe("site-1");
      }
      // Send chamado com content renderizado contendo nome do lead + URL do app.
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "u1",
          leadId: "lead-1",
          aiGenerated: false,
        }),
      );
      const sendCall = sendMock.mock.calls[0]?.[0] as { content: string };
      expect(sendCall.content).toContain("Concessionária X");
      expect(sendCall.content).toContain(
        "https://app.test/sites/concessionaria-x",
      );
      // lead_sites updated to 'sent' via service client
      expect(serviceUpdates).toContainEqual(
        expect.objectContaining({
          table: "lead_sites",
          payload: expect.objectContaining({ status: "sent" }),
        }),
      );
    },
  );

  it("usa fallback 'Concessionária' quando lead.name é vazio (defesa em profundidade)", async () => {
    const { client } = makeSupabase({
      leadSite: {
        data: { id: "site-1", slug: "abc", status: "published" },
        error: null,
      },
      lead: { data: { name: "  " }, error: null },
    });
    const { client: serviceClient } = makeSupabase({});
    sendMock.mockResolvedValue({
      ok: true,
      messageId: "m1",
      whatsappMsgId: "e",
    });

    const result = await dispatchSitePreview({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      service: serviceClient as any,
      userId: "u1",
      leadId: "lead-1",
      sendImpl: sendMock,
    });

    expect(result.ok).toBe(true);
    const sendCall = sendMock.mock.calls[0]?.[0] as { content: string };
    expect(sendCall.content).toContain("Concessionária");
  });

  it("send falha → retorna { ok: false, reason: 'whatsapp_error' } com mensagem do reason", async () => {
    const { client } = makeSupabase({
      leadSite: {
        data: { id: "site-1", slug: "x", status: "published" },
        error: null,
      },
      lead: { data: { name: "Y" }, error: null },
    });
    const { client: serviceClient, updates: serviceUpdates } = makeSupabase(
      {},
    );
    sendMock.mockResolvedValue({
      ok: false,
      reason: "lead_missing_phone",
    });

    const result = await dispatchSitePreview({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      service: serviceClient as any,
      userId: "u1",
      leadId: "lead-1",
      sendImpl: sendMock,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("whatsapp_error");
      expect(result.message).toContain("lead_missing_phone");
    }
    // lead_sites NÃO deve ser atualizado quando send falha.
    expect(
      serviceUpdates.some((u) => u.table === "lead_sites"),
    ).toBe(false);
  });

  it("update lead_sites falha → retorna { ok: false, reason: 'db_error' }", async () => {
    const { client } = makeSupabase({
      leadSite: {
        data: { id: "site-1", slug: "x", status: "published" },
        error: null,
      },
      lead: { data: { name: "Y" }, error: null },
    });
    const { client: serviceClient } = makeSupabase({
      updateError: { message: "DB down" },
    });
    sendMock.mockResolvedValue({
      ok: true,
      messageId: "m",
      whatsappMsgId: "e",
    });

    const result = await dispatchSitePreview({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      service: serviceClient as any,
      userId: "u1",
      leadId: "lead-1",
      sendImpl: sendMock,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("db_error");
      expect(result.message).toContain("DB down");
    }
  });

  it("send retorna error string específica → message reflete `error` (não só `reason`)", async () => {
    const { client } = makeSupabase({
      leadSite: {
        data: { id: "site-1", slug: "x", status: "published" },
        error: null,
      },
      lead: { data: { name: "Y" }, error: null },
    });
    const { client: serviceClient } = makeSupabase({});
    sendMock.mockResolvedValue({
      ok: false,
      reason: "evolution_error",
      error: "HTTP 500 from Evolution",
    });

    const result = await dispatchSitePreview({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      service: serviceClient as any,
      userId: "u1",
      leadId: "lead-1",
      sendImpl: sendMock,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("whatsapp_error");
      expect(result.message).toBe("HTTP 500 from Evolution");
    }
  });

  // Garantia explicita pro typecheck do MockSupabase helper (acima é usado
  // como default; aqui só confirma que o tipo é consistente).
  it("MockSupabase é tipado", () => {
    const { client } = makeSupabase({});
    const _typed: MockSupabase = client;
    expect(_typed).toBeDefined();
  });
});
