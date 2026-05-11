/**
 * Tests do Server Action `submitSiteForm` (Phase 7 — issues #161 + #223).
 *
 * #223 estende a action com:
 *   - Persistência em `lead_form_submissions` (gated por env flag
 *     `NEXT_PUBLIC_SITE_FORMS_ENABLED === '1'`) via service-role.
 *   - Rate limit por IP: 3 submissions / hora → bloqueia silenciosamente.
 *   - Honeypot field (`extras.honeypot`): se non-empty → silencioso success.
 *   - Min-time gate (`extras.renderedAt`): se `Date.now() - renderedAt
 *     < 2000ms` → silencioso success.
 *   - LGPD audit fields (`consent_text`, `consent_ip`,
 *     `consent_user_agent`, `consent_timestamp`).
 *   - Schema extendido com `message` opcional.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();
vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

const supabaseInsertMock = vi.fn();
const supabaseSelectMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabase: () => ({
    from: fromMock,
  }),
}));

vi.mock("@/lib/env-public", () => ({
  publicEnv: {
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    NEXT_PUBLIC_WHATSAPP_ENABLED: "0",
    NEXT_PUBLIC_SITE_FORMS_ENABLED: "1", // ON for persistence tests
  },
}));

import { submitSiteForm } from "@/app/actions/site-form";

const validPayload = {
  model: "Toyota Corolla",
  name: "Maria Silva",
  email: "maria@example.com",
  phone: "11987654321",
  lgpd: true as const,
};

/**
 * Mock Supabase `.from(table)` para retornar diferentes builders por
 * tabela tocada. Suporta:
 *   - `lead_sites`: select+eq+maybeSingle → retorna lead site
 *   - `lead_form_submissions` em modo SELECT (rate limit): select+eq+gte → resolve `[...]`
 *   - `lead_form_submissions` em modo INSERT: insert(payload) → resolve `{error:null}`
 */
function setupFromMock({
  leadSiteRow,
  rateLimitCount = 0,
  insertError = null,
}: {
  leadSiteRow?: { id: string; user_id: string } | null;
  rateLimitCount?: number;
  insertError?: { message: string } | null;
}) {
  fromMock.mockImplementation((table: string) => {
    if (table === "lead_sites") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: leadSiteRow ?? null, error: null }),
      };
    }
    if (table === "lead_form_submissions") {
      // Quando uma chain SELECT é montada (count rate-limit) os tests só
      // precisam que o terminal `.then`/await retorne `{ count, error }`.
      // Quando uma chain INSERT é montada, o terminal precisa retornar
      // `{ error }`.
      let mode: "select" | "insert" | null = null;
      const builder = {
        select: supabaseSelectMock.mockImplementation(() => {
          mode = "select";
          return builder;
        }),
        insert: supabaseInsertMock.mockImplementation(() => {
          mode = "insert";
          return builder;
        }),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        then: undefined as undefined | PromiseLike<unknown>["then"],
      };
      builder.then = ((onFulfilled, onRejected) => {
        if (mode === "insert") {
          return Promise.resolve({ error: insertError }).then(
            onFulfilled,
            onRejected,
          );
        }
        return Promise.resolve({
          count: rateLimitCount,
          error: null,
        }).then(onFulfilled, onRejected);
      }) as PromiseLike<unknown>["then"];
      return builder;
    }
    throw new Error(`Unmocked table: ${table}`);
  });
}

beforeEach(() => {
  fromMock.mockReset();
  supabaseInsertMock.mockReset();
  supabaseSelectMock.mockReset();
  headersMock.mockReset();
  // Default headers: provide IP + UA
  headersMock.mockReturnValue({
    get: (key: string) => {
      const map: Record<string, string> = {
        "x-forwarded-for": "203.0.113.1",
        "user-agent": "Mozilla/5.0 (Test)",
      };
      return map[key.toLowerCase()] ?? null;
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitSiteForm() — validation legacy (issue #161 compat)", () => {
  it("retorna erro quando siteId vazio", async () => {
    setupFromMock({ leadSiteRow: null });
    const r = await submitSiteForm("", validPayload);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toMatch(/siteId/i);
    }
  });

  it("retorna erro quando payload é inválido (email malformado)", async () => {
    setupFromMock({ leadSiteRow: { id: "site-1", user_id: "user-1" } });
    const r = await submitSiteForm("site-1", {
      ...validPayload,
      email: "naoeumemail",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toMatch(/email/i);
    }
  });

  it("retorna erro quando lgpd=false (sem consentimento)", async () => {
    setupFromMock({ leadSiteRow: { id: "site-1", user_id: "user-1" } });
    const r = await submitSiteForm("site-1", {
      ...validPayload,
      lgpd: false as unknown as true,
    });
    expect(r.success).toBe(false);
  });
});

describe("submitSiteForm() — persistência + LGPD audit (#223)", () => {
  it("persiste em lead_form_submissions com payload + LGPD audit fields", async () => {
    setupFromMock({
      leadSiteRow: { id: "site-uuid-123", user_id: "user-uuid-456" },
      rateLimitCount: 0,
    });
    const r = await submitSiteForm("site-uuid-123", {
      ...validPayload,
      message: "Tenho interesse no Toyota Corolla 2020 prata.",
    });
    expect(r).toEqual({ success: true });
    expect(supabaseInsertMock).toHaveBeenCalledTimes(1);
    const insertArg = supabaseInsertMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(insertArg).toMatchObject({
      user_id: "user-uuid-456",
      lead_site_id: "site-uuid-123",
      name: "Maria Silva",
      phone: "11987654321",
      email: "maria@example.com",
      model: "Toyota Corolla",
      consent_ip: "203.0.113.1",
      consent_user_agent: "Mozilla/5.0 (Test)",
    });
    expect(insertArg.consent_text).toMatch(/Pol[ií]tica/i);
    expect(insertArg.consent_timestamp).toBeTypeOf("string");
    expect(insertArg.message).toBe(
      "Tenho interesse no Toyota Corolla 2020 prata.",
    );
  });

  it("não persiste honeypot field nem renderedAt (defesa: PII bots)", async () => {
    setupFromMock({
      leadSiteRow: { id: "site-uuid-123", user_id: "user-uuid-456" },
      rateLimitCount: 0,
    });
    const ts = Date.now() - 5000; // 5s ago — passes min-time gate
    await submitSiteForm("site-uuid-123", validPayload, {
      honeypot: "",
      renderedAt: ts,
    });
    const insertArg = supabaseInsertMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(insertArg).not.toHaveProperty("website");
    expect(insertArg).not.toHaveProperty("honeypot");
    expect(insertArg).not.toHaveProperty("_rendered_at");
    expect(insertArg).not.toHaveProperty("rendered_at");
  });

  it("retorna db_error quando insert falha", async () => {
    setupFromMock({
      leadSiteRow: { id: "site-1", user_id: "user-1" },
      rateLimitCount: 0,
      insertError: { message: "duplicate key" },
    });
    const r = await submitSiteForm("site-1", validPayload);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toMatch(/erro/i);
    }
  });

  it("retorna erro quando lead_site não existe (RLS / not found)", async () => {
    setupFromMock({ leadSiteRow: null });
    const r = await submitSiteForm("site-1", validPayload);
    expect(r.success).toBe(false);
  });
});

describe("submitSiteForm() — honeypot anti-bot (#223)", () => {
  it("honeypot non-empty → silent success sem persistir", async () => {
    setupFromMock({
      leadSiteRow: { id: "site-1", user_id: "user-1" },
      rateLimitCount: 0,
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await submitSiteForm("site-1", validPayload, {
      honeypot: "http://spam.com", // bot preencheu
    });
    expect(r).toEqual({ success: true });
    expect(supabaseInsertMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    const warnMsg = warnSpy.mock.calls[0]?.[0];
    expect(String(warnMsg)).toMatch(/honeypot/i);
    warnSpy.mockRestore();
  });

  it("honeypot vazio passa pra fluxo normal", async () => {
    setupFromMock({
      leadSiteRow: { id: "site-1", user_id: "user-1" },
      rateLimitCount: 0,
    });
    const r = await submitSiteForm("site-1", validPayload, {
      honeypot: "",
    });
    expect(r).toEqual({ success: true });
    expect(supabaseInsertMock).toHaveBeenCalledTimes(1);
  });
});

describe("submitSiteForm() — min-time gate (#223)", () => {
  it("submit < 2000ms após mount → silent success sem persistir", async () => {
    setupFromMock({
      leadSiteRow: { id: "site-1", user_id: "user-1" },
      rateLimitCount: 0,
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const recentTs = Date.now() - 500; // 500ms ago — abaixo do threshold
    const r = await submitSiteForm("site-1", validPayload, {
      renderedAt: recentTs,
    });
    expect(r).toEqual({ success: true });
    expect(supabaseInsertMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    const warnMsg = warnSpy.mock.calls[0]?.[0];
    expect(String(warnMsg)).toMatch(/min_time|min-time|too_fast/i);
    warnSpy.mockRestore();
  });

  it("submit >= 2000ms após mount → persiste normalmente", async () => {
    setupFromMock({
      leadSiteRow: { id: "site-1", user_id: "user-1" },
      rateLimitCount: 0,
    });
    const oldTs = Date.now() - 5000; // 5s ago
    const r = await submitSiteForm("site-1", validPayload, {
      renderedAt: oldTs,
    });
    expect(r).toEqual({ success: true });
    expect(supabaseInsertMock).toHaveBeenCalledTimes(1);
  });

  it("renderedAt undefined (caller legacy) → não aplica gate", async () => {
    setupFromMock({
      leadSiteRow: { id: "site-1", user_id: "user-1" },
      rateLimitCount: 0,
    });
    const r = await submitSiteForm("site-1", validPayload);
    expect(r).toEqual({ success: true });
    expect(supabaseInsertMock).toHaveBeenCalledTimes(1);
  });
});

describe("submitSiteForm() — rate limit por IP (#223)", () => {
  it("3+ submissions na última hora → bloqueia com mensagem PT-BR", async () => {
    setupFromMock({
      leadSiteRow: { id: "site-1", user_id: "user-1" },
      rateLimitCount: 3,
    });
    const r = await submitSiteForm("site-1", validPayload);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toMatch(/muitas tentativas|tente novamente/i);
    }
    expect(supabaseInsertMock).not.toHaveBeenCalled();
  });

  it("count 2 → permite (limite é exclusivo no >= 3)", async () => {
    setupFromMock({
      leadSiteRow: { id: "site-1", user_id: "user-1" },
      rateLimitCount: 2,
    });
    const r = await submitSiteForm("site-1", validPayload);
    expect(r).toEqual({ success: true });
    expect(supabaseInsertMock).toHaveBeenCalledTimes(1);
  });

  it("fallback IP 'unknown' quando header x-forwarded-for ausente", async () => {
    headersMock.mockReturnValueOnce({
      get: () => null,
    });
    setupFromMock({
      leadSiteRow: { id: "site-1", user_id: "user-1" },
      rateLimitCount: 0,
    });
    const r = await submitSiteForm("site-1", validPayload);
    expect(r).toEqual({ success: true });
    const insertArg = supabaseInsertMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(insertArg.consent_ip).toBeNull();
  });
});
