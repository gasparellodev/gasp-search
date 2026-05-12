import { beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();
const fromMock = vi.fn();
const storageFromMock = vi.fn();

vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    SITE_FORM_HMAC_SECRET: undefined,
  },
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabase: () => ({
    from: fromMock,
    storage: { from: storageFromMock },
  }),
}));

import {
  _resetAnnouncementRateLimitForTests,
  requestUploadUrl,
  submitAnnouncement,
} from "@/app/actions/site-announcement";
import { SITE_FIXTURE } from "../../components/sites/site-fixtures";

const SITE_ID = "66666666-6666-4666-8666-666666666666";
const USER_ID = "77777777-7777-4777-8777-777777777777";
const SUBMISSION_ID = "88888888-8888-4888-8888-888888888888";

const validPayload = {
  marca: "Toyota",
  modelo: "Corolla XEi",
  ano: 2022,
  km: 35000,
  combustivel: "Flex",
  cambio: "Automático",
  cor: "Prata",
  motor: "2.0 16V",
  fipe_codigo: "123456-7",
  preco: 119900,
  nome: "Maria Silva",
  telefone: "(11) 98765-4321",
  email: "maria@example.com",
  mensagem: "Carro impecável, único dono.",
  car_target_slug: SITE_FIXTURE.cars[0]!.slug,
  lgpd_consent: true as const,
};

let leadFormInsertMock: ReturnType<typeof vi.fn>;
let consentInsertMock: ReturnType<typeof vi.fn>;
let deleteMock: ReturnType<typeof vi.fn>;
let signedUrlMock: ReturnType<typeof vi.fn>;

function setupSupabase({
  leadSiteRow = {
    id: SITE_ID,
    user_id: USER_ID,
    variables: SITE_FIXTURE,
  },
  submissionInsertError = null,
  consentInsertError = null,
  submissionLookup = { id: SUBMISSION_ID, lead_site_id: SITE_ID },
}: {
  leadSiteRow?: { id: string; user_id: string; variables: unknown } | null;
  submissionInsertError?: { message: string } | null;
  consentInsertError?: { message: string } | null;
  submissionLookup?: { id: string; lead_site_id: string } | null;
} = {}) {
  leadFormInsertMock = vi.fn();
  consentInsertMock = vi.fn();
  deleteMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });
  signedUrlMock = vi.fn().mockResolvedValue({
    data: { signedUrl: "https://storage.example/upload" },
    error: null,
  });

  fromMock.mockImplementation((table: string) => {
    if (table === "lead_sites") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: leadSiteRow,
          error: null,
        }),
      };
    }
    if (table === "lead_form_submissions") {
      return {
        insert: leadFormInsertMock.mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: submissionInsertError ? null : { id: SUBMISSION_ID },
              error: submissionInsertError,
            }),
          }),
        }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: submissionLookup,
          error: null,
        }),
        delete: deleteMock,
      };
    }
    if (table === "consent_logs") {
      return {
        insert: consentInsertMock.mockResolvedValue({
          error: consentInsertError,
        }),
      };
    }
    throw new Error(`Unmocked table: ${table}`);
  });

  storageFromMock.mockReturnValue({
    createSignedUploadUrl: signedUrlMock,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetAnnouncementRateLimitForTests();
  headersMock.mockResolvedValue({
    get: (key: string) => {
      const map: Record<string, string> = {
        origin: "http://localhost:3000",
        "x-forwarded-for": "203.0.113.10",
        "user-agent": "Vitest UA",
      };
      return map[key.toLowerCase()] ?? null;
    },
  });
  setupSupabase();
});

describe("submitAnnouncement()", () => {
  it("persiste submission e consent_logs com payload válido", async () => {
    const r = await submitAnnouncement(SITE_ID, validPayload);

    expect(r).toEqual({ ok: true, leadId: SUBMISSION_ID, uploadToken: null });
    expect(leadFormInsertMock).toHaveBeenCalledTimes(1);
    expect(leadFormInsertMock.mock.calls[0]?.[0]).toMatchObject({
      user_id: USER_ID,
      lead_site_id: SITE_ID,
      name: "Maria Silva",
      phone: "(11) 98765-4321",
      email: "maria@example.com",
      model: "Toyota Corolla XEi 2022",
      consent_ip: "203.0.113.10",
      consent_user_agent: "Vitest UA",
    });
    expect(String(leadFormInsertMock.mock.calls[0]?.[0].message)).toContain(
      "Entrada para:",
    );
    expect(consentInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        ip: "203.0.113.10",
        consent_text:
          "Concordo com o tratamento dos meus dados pessoais para fins de avaliação de veículo, conforme a LGPD.",
        version: "tradein_submission_v1",
        categories: expect.objectContaining({
          necessary: true,
          purpose: "tradein_submission",
          lead_id: SUBMISSION_ID,
        }),
      }),
    );
  });

  it("retorna { ok: true } silencioso quando honeypot é preenchido", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await submitAnnouncement(SITE_ID, validPayload, {
      honeypot: "spam",
    });
    expect(r).toEqual({ ok: true, leadId: "", uploadToken: null });
    expect(leadFormInsertMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("bloqueia após 3 submits por hora por IP", async () => {
    expect((await submitAnnouncement(SITE_ID, validPayload)).ok).toBe(true);
    expect((await submitAnnouncement(SITE_ID, validPayload)).ok).toBe(true);
    expect((await submitAnnouncement(SITE_ID, validPayload)).ok).toBe(true);

    const r = await submitAnnouncement(SITE_ID, validPayload);
    expect(r).toEqual({
      ok: false,
      error: "Muitas tentativas. Tente novamente em 1 hora.",
    });
  });

  it("rejeita origin cross-site", async () => {
    headersMock.mockResolvedValue({
      get: (key: string) => (key.toLowerCase() === "origin" ? "https://evil.example" : null),
    });

    const r = await submitAnnouncement(SITE_ID, validPayload);
    expect(r).toEqual({ ok: false, error: "Origem inválida" });
    expect(leadFormInsertMock).not.toHaveBeenCalled();
  });

  it("retorna erro quando payload é inválido", async () => {
    const r = await submitAnnouncement(SITE_ID, {
      ...validPayload,
      email: "naoeumemail",
    });
    expect(r.ok).toBe(false);
  });

  it("remove a submission se consent_logs falhar", async () => {
    setupSupabase({ consentInsertError: { message: "db down" } });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const r = await submitAnnouncement(SITE_ID, validPayload);

    expect(r.ok).toBe(false);
    expect(deleteMock).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("requestUploadUrl()", () => {
  it("gera URL assinada para foto JPEG válida", async () => {
    const r = await requestUploadUrl(SITE_ID, {
      leadId: SUBMISSION_ID,
      uploadToken: null,
      index: 0,
      ext: "jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
      magicHeader: "ffd8ffe000104a4649460001",
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.path).toMatch(new RegExp(`^${SUBMISSION_ID}/0-\\d+\\.jpg$`));
      expect(r.signedUrl).toBe("https://storage.example/upload");
    }
    expect(signedUrlMock).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${SUBMISSION_ID}/0-\\d+\\.jpg$`)),
      { upsert: false },
    );
  });

  it("rejeita magic bytes incompatíveis", async () => {
    const r = await requestUploadUrl(SITE_ID, {
      leadId: SUBMISSION_ID,
      uploadToken: null,
      index: 0,
      ext: "jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
      magicHeader: "89504e470d0a1a0a00000000",
    });

    expect(r).toEqual({ ok: false, error: "Assinatura do arquivo inválida." });
    expect(signedUrlMock).not.toHaveBeenCalled();
  });
});
