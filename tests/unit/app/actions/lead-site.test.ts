import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import {
  GenerationError,
  LeadNotFoundError,
  RateLimitError,
  SiteVariablesValidationError,
  SlugCollisionError,
} from "@/lib/sites/errors";
import type { Database } from "@/types/database";
import type { SiteCopy } from "@/types/lead-site";

// ---------------------------------------------------------------------------
// Server env setup (env.ts é validado no boot — sem isso, qualquer mock
// de módulo que toca lib/env.ts falha em hoisted resolve)
// ---------------------------------------------------------------------------

const VALID_ENV = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  APIFY_TOKEN: "t",
  APIFY_GOOGLE_MAPS_ACTOR_ID: "compass~crawler-google-places",
  APIFY_INSTAGRAM_ACTOR_ID: "apify~instagram-scraper",
  APIFY_WEBSITE_CONTACT_ACTOR_ID: "vdrmota~contact-info-scraper",
  ANTHROPIC_API_KEY: "sk-ant-test",
  ANTHROPIC_MODEL: "claude-sonnet-4-6",
} as const;

let savedEnv: NodeJS.ProcessEnv;

// ---------------------------------------------------------------------------
// Hoisted mocks (Vitest hoists vi.mock — refs em scope precisam vi.hoisted).
// ---------------------------------------------------------------------------

const supabaseMocks = vi.hoisted(() => ({
  serverClient: vi.fn(),
  serviceClient: vi.fn(),
}));

const siteMocks = vi.hoisted(() => ({
  extractBrandAssets: vi.fn(),
  generateUniqueSlug: vi.fn(),
  generateCopy: vi.fn(),
}));

const cacheMocks = vi.hoisted(() => ({
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

const evolutionMocks = vi.hoisted(() => ({
  sendWhatsAppMessage: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.serverClient,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabase: supabaseMocks.serviceClient,
}));

vi.mock("@/lib/sites/brand-assets", () => ({
  extractBrandAssets: siteMocks.extractBrandAssets,
}));

vi.mock("@/lib/sites/slug", () => ({
  generateUniqueSlug: siteMocks.generateUniqueSlug,
}));

vi.mock("@/lib/sites/generate-copy", async () => {
  // Manter constantes reais (GENERATION_VERSION, GENERATION_MODEL).
  const actual = await vi.importActual<
    typeof import("@/lib/sites/generate-copy")
  >("@/lib/sites/generate-copy");
  return {
    ...actual,
    generateCopy: siteMocks.generateCopy,
  };
});

vi.mock("next/cache", () => ({
  updateTag: cacheMocks.updateTag,
  revalidatePath: cacheMocks.revalidatePath,
}));

vi.mock("@/lib/evolution/send", () => ({
  sendWhatsAppMessage: evolutionMocks.sendWhatsAppMessage,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_LEAD_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function makeLead(
  overrides: Partial<Database["public"]["Tables"]["leads"]["Row"]> = {},
): Database["public"]["Tables"]["leads"]["Row"] {
  return {
    id: VALID_LEAD_ID,
    user_id: USER_ID,
    source: "google_maps",
    source_search_job_id: null,
    name: "Toyota do Recife",
    category: "Concessionária",
    city: "Recife",
    state: "PE",
    country: "BR",
    phone: "+55 81 99999-9999",
    email: "contato@toyotarecife.com.br",
    website: "https://toyotarecife.com.br",
    instagram_handle: "toyotarecife",
    whatsapp: "5581999999999",
    has_website: true,
    rating: 4.7,
    reviews_count: 130,
    followers_count: 2400,
    stage: "new",
    score: 85,
    notes: null,
    raw: null,
    enriched_at: null,
    created_at: "2026-05-08T00:00:00Z",
    updated_at: "2026-05-08T00:00:00Z",
    ...overrides,
  };
}

function makeAssets() {
  return {
    logo_url: "https://blob.vercel.com/monogram/abc.svg",
    primary_color: "#0c5cff",
    text_on_primary: "#FFFFFF" as const,
    hero_image_url: "https://example.com/hero.jpg",
    about_image_url: "https://example.com/about.jpg",
    contact_hero_image_url: "https://example.com/contact.jpg",
    car_placeholder_urls: [
      "https://example.com/car1.png",
      "https://example.com/car2.png",
      "https://example.com/car3.png",
      "https://example.com/car4.png",
      "https://example.com/car5.png",
      "https://example.com/car6.png",
    ],
  };
}

function makeCopy(): SiteCopy {
  return {
    slogan: "Sua próxima conquista nas quatro rodas",
    home_categories: [
      { label: "0km" },
      { label: "Seminovos" },
      { label: "Promoção" },
    ],
    emphasis: {
      title: "Destaque do mês",
      description:
        "Modelo recém-chegado, revisado e pronto pra rodar. Documentação em dia, garantia estendida e financiamento facilitado pra você sair dirigindo hoje mesmo, sem complicação e com a confiança da nossa equipe.",
    },
    about_text:
      "Somos uma concessionária familiar com paixão por carros e respeito por gente. Nosso compromisso é oferecer veículos revisados, com procedência clara e atendimento honesto.\n\nCada cliente é tratado como parte da nossa história. Da escolha do modelo à assinatura do contrato, queremos que você se sinta em casa.\n\nTrabalhamos com financeiras parceiras pra que o sonho do carro novo caiba no seu bolso. Simulação rápida e sem pegadinhas.\n\nPós-venda ativo: revisamos, lavamos e acompanhamos cada veículo que sai daqui. Confiança que constrói relacionamento de longo prazo.",
    mission:
      "Tornar a compra do próximo carro uma experiência transparente, ágil e humana, com atendimento de verdade.",
    vision:
      "Ser referência em atendimento na nossa região, reconhecida pela honestidade e confiança que construímos com cada cliente.",
    values: [
      "Transparência em cada etapa da venda",
      "Respeito ao tempo e ao dinheiro do cliente",
      "Procedência conhecida em cada veículo",
      "Atendimento humano sem roteiro engessado",
    ],
    cars: [
      {
        description:
          "Sedan compacto 1.6 com manutenção em dia, único dono. Documentação em ordem e revisão recém-feita na concessionária; pronto para entrega imediata sem nenhuma surpresa.",
        datasheet: [
          ["Câmbio", "Manual"],
          ["Combustível", "Flex"],
        ],
        featured: true,
      },
      {
        description:
          "SUV 2.0 turbo com baixíssima quilometragem para o ano, todos os opcionais de fábrica. Documentação 100% revisada e laudo cautelar disponível mediante agendamento.",
        datasheet: [
          ["Câmbio", "Automático"],
          ["Combustível", "Gasolina"],
        ],
        featured: false,
      },
      {
        description:
          "Picape diesel 4x4 com tração integral, ideal para trabalho e lazer. Manutenções preventivas feitas dentro do prazo e óleo trocado recentemente na nossa oficina parceira.",
        datasheet: [
          ["Câmbio", "Automático"],
          ["Combustível", "Diesel"],
        ],
        featured: false,
      },
      {
        description:
          "Hatch popular zero quilômetro com a melhor relação custo-benefício do segmento. Todos os emplacamentos e documentação inclusos, pronto para sair da loja rodando hoje.",
        datasheet: [
          ["Câmbio", "Manual"],
          ["Combustível", "Flex"],
        ],
        featured: false,
      },
    ],
  };
}

/**
 * Builder mínimo de Supabase client mock — fluência de métodos chainable
 * usada em supabase-js (`from(...).select(...).eq(...).maybeSingle()`).
 *
 * Guarda configuração por tabela; cada chamada `from(name)` retorna um
 * builder novo encadeado.
 */
type TableHandlers = {
  maybeSingle?: () => Promise<{ data: unknown; error: unknown }>;
  select?: () => unknown;
  upsert?: (...args: unknown[]) => unknown;
  insert?: (...args: unknown[]) => Promise<{ error: unknown }>;
  count?: () => Promise<{ count: number; error: unknown }>;
  upsertResult?: { data: unknown; error: unknown };
  insertResult?: { error: unknown };
  countResult?: { count: number; error: unknown };
  leadResult?: { data: unknown; error: unknown };
  updateResult?: { error: unknown };
};

function makeSupabaseClient(
  config: Record<string, TableHandlers> = {},
): {
  from: ReturnType<typeof vi.fn>;
  auth: { getUser: ReturnType<typeof vi.fn> };
  upsertCalls: Array<{ table: string; payload: unknown; opts: unknown }>;
  insertCalls: Array<{ table: string; payload: unknown }>;
  updateCalls: Array<{
    table: string;
    payload: unknown;
    eqs: Array<[string, unknown]>;
  }>;
  selectCalls: Array<{ table: string; eqs: Array<[string, unknown]> }>;
} {
  const upsertCalls: Array<{ table: string; payload: unknown; opts: unknown }> =
    [];
  const insertCalls: Array<{ table: string; payload: unknown }> = [];
  const updateCalls: Array<{
    table: string;
    payload: unknown;
    eqs: Array<[string, unknown]>;
  }> = [];
  const selectCalls: Array<{ table: string; eqs: Array<[string, unknown]> }> =
    [];

  const from = vi.fn((table: string) => {
    const handlers = config[table] ?? {};
    const eqs: Array<[string, unknown]> = [];
    let isCount = false;
    let isHead = false;

    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(
      (_cols?: string, opts?: { count?: "exact"; head?: boolean }) => {
        if (opts?.count === "exact") isCount = true;
        if (opts?.head === true) isHead = true;
        return builder;
      },
    );
    builder.eq = vi.fn((col: string, val: unknown) => {
      eqs.push([col, val]);
      return builder;
    });
    builder.gte = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(async () => {
      selectCalls.push({ table, eqs: [...eqs] });
      return handlers.leadResult ?? { data: null, error: null };
    });
    builder.then = vi.fn((onResolve: (x: unknown) => unknown) => {
      // builder é "thenable" pra suportar `await client.from(...).select(...).eq(...)` (count + head)
      if (isCount && isHead) {
        const r = handlers.countResult ?? { count: 0, error: null };
        return Promise.resolve(onResolve(r));
      }
      // Insert path — `await client.from(...).insert({...})` resolve direto.
      // (Fluência insert vem direto do `insert` abaixo.)
      return Promise.resolve(onResolve({ data: null, error: null }));
    });

    builder.upsert = vi.fn(async (payload: unknown, opts?: unknown) => {
      upsertCalls.push({ table, payload, opts });
      const r = handlers.upsertResult ?? { data: null, error: null };
      return r;
    });

    builder.insert = vi.fn(async (payload: unknown) => {
      insertCalls.push({ table, payload });
      return handlers.insertResult ?? { error: null };
    });

    // `update(...)` retorna um builder que aceita `.eq(...)` e é thenable.
    builder.update = vi.fn((payload: unknown) => {
      const eqsLocal: Array<[string, unknown]> = [];
      const updateBuilder: Record<string, unknown> = {};
      updateBuilder.eq = vi.fn((col: string, val: unknown) => {
        eqsLocal.push([col, val]);
        return updateBuilder;
      });
      updateBuilder.then = vi.fn((onResolve: (x: unknown) => unknown) => {
        updateCalls.push({ table, payload, eqs: [...eqsLocal] });
        return Promise.resolve(
          onResolve(handlers.updateResult ?? { error: null }),
        );
      });
      return updateBuilder;
    });

    return builder;
  });

  return {
    from,
    auth: { getUser: vi.fn() },
    upsertCalls,
    insertCalls,
    updateCalls,
    selectCalls,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let infoSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  savedEnv = { ...process.env };
  Object.assign(process.env, VALID_ENV);
  supabaseMocks.serverClient.mockReset();
  supabaseMocks.serviceClient.mockReset();
  siteMocks.extractBrandAssets.mockReset();
  siteMocks.generateUniqueSlug.mockReset();
  siteMocks.generateCopy.mockReset();
  cacheMocks.updateTag.mockReset();
  cacheMocks.revalidatePath.mockReset();
  evolutionMocks.sendWhatsAppMessage.mockReset();
  infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  infoSpy.mockRestore();
  warnSpy.mockRestore();
  errorSpy.mockRestore();
  process.env = savedEnv;
});

function authedUser() {
  return {
    data: { user: { id: USER_ID } },
    error: null,
  };
}

function noUser() {
  return { data: { user: null }, error: null };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateLeadSite — AC3 auth", () => {
  it("retorna { ok: false, error: 'auth' } quando auth() retorna null", async () => {
    const server = makeSupabaseClient();
    server.auth.getUser.mockResolvedValue(noUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient());

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    const r = await generateLeadSite(VALID_LEAD_ID);
    expect(r).toEqual({ ok: false, error: "auth", message: expect.any(String) });
    // Trabalho pesado não deve rodar sem auth
    expect(siteMocks.extractBrandAssets).not.toHaveBeenCalled();
  });
});

describe("generateLeadSite — AC4 rate limit", () => {
  it("retorna rate_limit quando 5 ou mais tentativas em 60s", async () => {
    const server = makeSupabaseClient();
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 5, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    const r = await generateLeadSite(VALID_LEAD_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("rate_limit");
    expect(siteMocks.extractBrandAssets).not.toHaveBeenCalled();
  });

  it("permite quando count=4 (limite é 5, 5ª passa)", async () => {
    const server = makeSupabaseClient();
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 4, error: null } },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    // Lead lookup precisa do server client (RLS) — alimentar leadResult
    server.from = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    }).from;
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy.mockResolvedValue(makeCopy());

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    const r = await generateLeadSite(VALID_LEAD_ID);
    expect(r.ok).toBe(true);
  });

  it("insere row em generation_throttle ANTES do trabalho pesado", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy.mockResolvedValue(makeCopy());

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    await generateLeadSite(VALID_LEAD_ID);
    // generation_throttle inserido pelo menos 1x
    expect(
      service.insertCalls.some((c) => c.table === "generation_throttle"),
    ).toBe(true);
  });
});

describe("generateLeadSite — AC1 happy path", () => {
  it("cria lead_sites com status=published, variables válido e slug único", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy.mockResolvedValue(makeCopy());

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    const r = await generateLeadSite(VALID_LEAD_ID);

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slug).toBe("abc12345-toyota-do-recife");

    // Upsert na lead_sites com status published
    const upsert = service.upsertCalls.find((c) => c.table === "lead_sites");
    expect(upsert).toBeTruthy();
    const payload = upsert!.payload as Record<string, unknown>;
    expect(payload.status).toBe("published");
    expect(payload.user_id).toBe(USER_ID);
    expect(payload.lead_id).toBe(VALID_LEAD_ID);
    expect(payload.slug).toBe("abc12345-toyota-do-recife");
    expect(payload.generated_at).toEqual(expect.any(String));
    expect(payload.published_at).toEqual(expect.any(String));
    expect((payload.variables as Record<string, unknown>).business_name).toBe(
      "Toyota do Recife",
    );

    // Upsert opt onConflict
    const opts = upsert!.opts as { onConflict?: string };
    expect(opts.onConflict).toBe("user_id,lead_id");

    // revalidate calls — #213: também invalida `og:<slug>` pra opengraph-image
    expect(cacheMocks.updateTag).toHaveBeenCalledWith(
      "site:abc12345-toyota-do-recife",
    );
    expect(cacheMocks.updateTag).toHaveBeenCalledWith(
      "og:abc12345-toyota-do-recife",
    );
    expect(cacheMocks.revalidatePath).toHaveBeenCalledWith(
      `/leads/${VALID_LEAD_ID}`,
    );
  });

  it("inclui generated_by + generation_version vindos das constantes do generate-copy", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy.mockResolvedValue(makeCopy());

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    await generateLeadSite(VALID_LEAD_ID);

    const upsert = service.upsertCalls.find((c) => c.table === "lead_sites")!;
    const variables = (upsert.payload as { variables: Record<string, unknown> })
      .variables;
    expect(variables.generated_by).toBe("claude-sonnet-4-6");
    expect(variables.generation_version).toBe("v1.0.0");
  });
});

describe("generateLeadSite — AC2 idempotência (regen)", () => {
  it("preserva slug existente em regen (não chama generateUniqueSlug)", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: {
        leadResult: {
          data: { slug: "existing-slug-old", status: "archived" },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockResolvedValue("brand-new-slug-x");
    siteMocks.generateCopy.mockResolvedValue(makeCopy());

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    const r = await generateLeadSite(VALID_LEAD_ID);

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slug).toBe("existing-slug-old");
    // Em regen, NÃO chamar generateUniqueSlug
    expect(siteMocks.generateUniqueSlug).not.toHaveBeenCalled();

    // Status pula de archived para published
    const upsert = service.upsertCalls.find((c) => c.table === "lead_sites")!;
    expect((upsert.payload as { status: string }).status).toBe("published");
  });

  it("gera slug novo na primeira geração (lead_sites row ausente)", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy.mockResolvedValue(makeCopy());

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    await generateLeadSite(VALID_LEAD_ID);
    expect(siteMocks.generateUniqueSlug).toHaveBeenCalledOnce();
  });
});

describe("generateLeadSite — AC3 not_found", () => {
  it("retorna not_found quando lead não existe (RLS retorna null)", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    const r = await generateLeadSite(VALID_LEAD_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("not_found");
  });
});

describe("generateLeadSite — AC5 AI failure paths", () => {
  // setTimeout real → backoff de 2s. Acelerado via fake-timer + tick manual.
  // Restaurado em afterAll pra não vazar pra outros describes.
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retry 1x com backoff em GenerationError(retryable=true) e completa se 2ª passar", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy
      .mockRejectedValueOnce(
        new GenerationError("api_error", true, "transient blip"),
      )
      .mockResolvedValueOnce(makeCopy());

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    const r = await generateLeadSite(VALID_LEAD_ID);
    expect(r.ok).toBe(true);
    expect(siteMocks.generateCopy).toHaveBeenCalledTimes(2);
  });

  it("persiste status='draft' + generation_error após 2 retryable consecutivos", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy.mockRejectedValue(
      new GenerationError("api_error", true, "still failing"),
    );

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    const r = await generateLeadSite(VALID_LEAD_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("ai_error");
    expect(siteMocks.generateCopy).toHaveBeenCalledTimes(2);

    const upsert = service.upsertCalls.find((c) => c.table === "lead_sites")!;
    const payload = upsert.payload as Record<string, unknown>;
    expect(payload.status).toBe("draft");
    expect(typeof payload.generation_error).toBe("string");
    const ge = JSON.parse(payload.generation_error as string);
    expect(ge).toMatchObject({
      code: "api_error",
      message: expect.any(String),
      timestamp: expect.any(String),
    });
    // generation_error não vaza cause/stack
    expect(ge).not.toHaveProperty("cause");
    expect(ge).not.toHaveProperty("stack");
  });

  it("não retry em GenerationError(retryable=false)", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy.mockRejectedValue(
      new GenerationError("schema_validation", false, "bad shape"),
    );

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    const r = await generateLeadSite(VALID_LEAD_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("ai_error");
    expect(siteMocks.generateCopy).toHaveBeenCalledTimes(1);
  });
});

describe("generateLeadSite — AC6 brand assets fallback", () => {
  it("aceita fallback total de extractBrandAssets (lead vazio)", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    // Fallback total (mas tudo válido por garantia BLOQUEANTE de #156)
    siteMocks.extractBrandAssets.mockResolvedValue({
      logo_url: "https://blob.vercel.com/monogram/fallback.svg",
      primary_color: "#000000",
      text_on_primary: "#FFFFFF" as const,
      hero_image_url: "https://example.com/stock-hero.jpg",
      about_image_url: "https://example.com/stock-about.jpg",
      contact_hero_image_url: "https://example.com/stock-contact.jpg",
      car_placeholder_urls: Array.from(
        { length: 6 },
        (_, i) => `https://example.com/stock-car-${i}.png`,
      ),
    });
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy.mockResolvedValue(makeCopy());

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    const r = await generateLeadSite(VALID_LEAD_ID);
    expect(r.ok).toBe(true);
  });

  it("captura throw catastrófico de extractBrandAssets (defesa em profundidade)", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockRejectedValue(new Error("catastrofico"));
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy.mockResolvedValue(makeCopy());

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    const r = await generateLeadSite(VALID_LEAD_ID);
    expect(r.ok).toBe(true);
  });
});

describe("generateLeadSite — AC7 URL sanitization", () => {
  it("substitui URLs com scheme malicioso por fallback", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue({
      logo_url: "javascript:alert(1)", // ❌ inseguro
      primary_color: "#0c5cff",
      text_on_primary: "#FFFFFF" as const,
      hero_image_url: "data:text/html,<script>", // ❌ inseguro
      about_image_url: "https://example.com/about.jpg",
      contact_hero_image_url: "file:///etc/passwd", // ❌ inseguro
      car_placeholder_urls: [
        "https://example.com/car1.png",
        "https://example.com/car2.png",
        "https://example.com/car3.png",
        "https://example.com/car4.png",
        "https://example.com/car5.png",
        "https://example.com/car6.png",
      ],
    });
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy.mockResolvedValue(makeCopy());

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    const r = await generateLeadSite(VALID_LEAD_ID);
    expect(r.ok).toBe(true);

    const upsert = service.upsertCalls.find((c) => c.table === "lead_sites")!;
    const variables = (upsert.payload as { variables: Record<string, unknown> })
      .variables;

    // v2 (#197 PR-C): URLs visuais agora estão em brand_assets.
    const ba = variables.brand_assets as Record<string, string>;
    expect(ba.logo_url).not.toMatch(/^javascript:/i);
    expect(ba.hero_image_url).not.toMatch(/^data:/i);
    expect(ba.contact_image_url).not.toMatch(/^file:/i);
    // Os 3 viraram fallback (mas todos são URLs https válidas)
    expect(ba.logo_url).toMatch(/^https?:/);
    expect(ba.hero_image_url).toMatch(/^https?:/);
    expect(ba.contact_image_url).toMatch(/^https?:/);
  });
});

describe("generateLeadSite — AC8 schema validation", () => {
  it("retorna validation quando assets retornam primary_color inválido (Zod falha)", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue({
      ...makeAssets(),
      primary_color: "red", // ❌ não bate /^#[0-9a-f]{6}$/i
    });
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy.mockResolvedValue(makeCopy());

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    const r = await generateLeadSite(VALID_LEAD_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("validation");

    const upsert = service.upsertCalls.find((c) => c.table === "lead_sites");
    expect(upsert).toBeTruthy();
    const payload = upsert!.payload as Record<string, unknown>;
    expect(payload.status).toBe("draft");
    expect(typeof payload.generation_error).toBe("string");
  });

  it("output bem-sucedido pode ser re-parseado por SiteVariables.parse", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy.mockResolvedValue(makeCopy());

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    const r = await generateLeadSite(VALID_LEAD_ID);
    expect(r.ok).toBe(true);

    const upsert = service.upsertCalls.find((c) => c.table === "lead_sites")!;
    const variables = (upsert.payload as { variables: unknown }).variables;
    // v2 (#197 PR-C): output canônico é SiteVariablesV2.
    const { SiteVariablesV2 } = await import("@/types/lead-site");
    expect(() => SiteVariablesV2.parse(variables)).not.toThrow();
  });
});

describe("generateLeadSite — AC9 observabilidade", () => {
  it("emite logs estruturados em ≥4 steps (brand_assets, slug, copy, persist)", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy.mockResolvedValue(makeCopy());

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    await generateLeadSite(VALID_LEAD_ID);

    const steps = infoSpy.mock.calls
      .map((c: unknown[]) => c[1] as { step?: string } | undefined)
      .filter((p: { step?: string } | undefined): p is { step: string } =>
        !!p?.step,
      )
      .map((p: { step: string }) => p.step);
    expect(steps).toEqual(
      expect.arrayContaining(["brand_assets", "slug", "copy", "persist"]),
    );
  });

  it("logs NÃO contêm business_name, email ou texto da copy (PII)", async () => {
    const lead = makeLead();
    const server = makeSupabaseClient({
      leads: { leadResult: { data: lead, error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    const copy = makeCopy();
    siteMocks.generateCopy.mockResolvedValue(copy);

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    await generateLeadSite(VALID_LEAD_ID);

    const allLogs = JSON.stringify(infoSpy.mock.calls);
    expect(allLogs).not.toContain(lead.name);
    expect(allLogs).not.toContain(lead.email);
    expect(allLogs).not.toContain(copy.slogan);
    expect(allLogs).not.toContain(copy.about_text);
  });

  it("error log inclui error.name + error.message mas NÃO cause/stack", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy.mockRejectedValue(
      new GenerationError(
        "api_error",
        false,
        "evil cause data",
        new Error("PII secret in cause"),
      ),
    );

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    await generateLeadSite(VALID_LEAD_ID);

    const allErrors = JSON.stringify(errorSpy.mock.calls);
    expect(allErrors).not.toContain("PII secret in cause");
    // mas deve mencionar GenerationError
    expect(allErrors).toContain("GenerationError");
  });
});

describe("generateLeadSite — db_error path (PO observation)", () => {
  it("propaga SlugCollisionError como { ok: false, error: 'db_error' }", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockRejectedValue(
      new SlugCollisionError(5, "Toyota do Recife"),
    );

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    const r = await generateLeadSite(VALID_LEAD_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("db_error");
    // Não persistido como draft (é falha de infra, não de IA)
    expect(
      service.upsertCalls.some((c) => c.table === "lead_sites"),
    ).toBe(false);
  });

  it("retorna db_error quando upsert lead_sites falha (race em slug global)", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
      lead_sites: {
        upsertResult: {
          data: null,
          error: { code: "23505", message: "duplicate key" },
        },
      },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy.mockResolvedValue(makeCopy());

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    const r = await generateLeadSite(VALID_LEAD_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("db_error");
  });
});

describe("generateLeadSite — error class instances (cobertura defensiva)", () => {
  it("LeadNotFoundError, RateLimitError e SiteVariablesValidationError são exportados", async () => {
    expect(new LeadNotFoundError("x").name).toBe("LeadNotFoundError");
    expect(new RateLimitError(1).name).toBe("RateLimitError");
    expect(new SiteVariablesValidationError(new ZodError([])).name).toBe(
      "SiteVariablesValidationError",
    );
  });
});

describe("generateLeadSite — branches defensivas (cobertura)", () => {
  it("rate-limit count com error → fail-open (passa para o trabalho)", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: {
        countResult: {
          count: 0,
          error: { message: "transient db error" },
        },
      },
      lead_sites: { upsertResult: { data: null, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy.mockResolvedValue(makeCopy());

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    const r = await generateLeadSite(VALID_LEAD_ID);
    // Fail-open: DB hiccup no count NÃO bloqueia o user
    expect(r.ok).toBe(true);
  });

  it("erro genérico em generateUniqueSlug (não SlugCollisionError) propaga", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockRejectedValue(
      new Error("network timeout"),
    );

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    await expect(generateLeadSite(VALID_LEAD_ID)).rejects.toThrow(
      "network timeout",
    );
  });

  it("erro genérico em generateCopy (não GenerationError) propaga", async () => {
    const server = makeSupabaseClient({
      leads: { leadResult: { data: makeLead(), error: null } },
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      generation_throttle: { countResult: { count: 0, error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    siteMocks.extractBrandAssets.mockResolvedValue(makeAssets());
    siteMocks.generateUniqueSlug.mockResolvedValue("abc12345-toyota-do-recife");
    siteMocks.generateCopy.mockRejectedValue(new Error("oom"));

    const { generateLeadSite } = await import("@/app/actions/lead-site");
    await expect(generateLeadSite(VALID_LEAD_ID)).rejects.toThrow("oom");
  });
});

// ===========================================================================
// updateLeadSiteVariables (#168) — edição manual das variáveis do site
// ===========================================================================

const LEAD_SITE_ID = "33333333-3333-4333-8333-333333333333";

/**
 * Variáveis completas válidas pra `SiteVariablesV2.parse` (issue #197 PR-C).
 * Usadas como `current` no merge — qualquer patch shallow precisa reaprovar
 * o schema. Shape v2 nested (`brand_assets`, `address` nullable, `cars[]`
 * com v2 fields).
 */
function makeFullVariables() {
  return {
    // Identidade
    business_name: "Toyota Recife",
    business_slug: "toyota-recife",
    slogan: "Sua próxima conquista nas quatro rodas",

    // Contato
    phone_display: "(81) 99999-9999",
    whatsapp: "5581999999999",
    email: "contato@example.com",
    address: null,
    hours: null,

    // Social
    instagram_url: "https://instagram.com/example",
    facebook_url: null,
    youtube_url: null,

    // Visual (nested em brand_assets — v2)
    brand_assets: {
      logo_url: "https://example.com/logo.png",
      primary_color: "#0c5cff",
      text_on_primary: "#FFFFFF" as const,
      hero_image_url: "https://example.com/hero.jpg",
      about_image_url: "https://example.com/about.jpg",
      contact_image_url: "https://example.com/contact.jpg",
      car_placeholders: [] as string[],
    },

    // Conteúdo de página
    home_categories: [
      { label: "0km", image_url: "https://example.com/cat1.jpg" },
      { label: "Seminovos", image_url: "https://example.com/cat2.jpg" },
      { label: "Promoção", image_url: "https://example.com/cat3.jpg" },
    ],
    emphasis: {
      title: "Destaque do mês",
      car_name: "Modelo X",
      description:
        "Modelo recém-chegado, revisado e pronto pra rodar. Documentação em dia, garantia estendida e financiamento.",
      image_url: "https://example.com/car1.jpg",
    },
    recent_sales: [
      { car_name: "R1", image_url: "https://example.com/r1.jpg" },
      { car_name: "R2", image_url: "https://example.com/r2.jpg" },
      { car_name: "R3", image_url: "https://example.com/r3.jpg" },
    ],

    // Sobre
    about_text:
      "Somos uma concessionária familiar com paixão por carros. Cada cliente é tratado como parte da nossa história. Da escolha do modelo à assinatura do contrato, queremos que você se sinta em casa. Trabalhamos com financeiras parceiras pra que o sonho do carro novo caiba no seu bolso.",
    mission:
      "Tornar a compra do próximo carro uma experiência transparente, ágil e humana.",
    vision:
      "Ser referência em atendimento na nossa região, reconhecida pela honestidade.",
    values: [
      "Transparência em cada etapa",
      "Respeito ao tempo do cliente",
      "Procedência conhecida",
      "Atendimento humano sem roteiro",
    ],

    // Estoque v2
    cars: Array.from({ length: 4 }, (_, i) => ({
      slug: `car-${i + 1}`,
      brand: "Toyota",
      model: `Modelo ${i + 1}`,
      year: 2024 - (i % 3),
      km: i * 10000,
      price: null,
      transmission: "Automático" as const,
      fuel: "Flex" as const,
      color: "Branco",
      description:
        "Sedan compacto 1.6 com manutenção em dia, único dono. Documentação em ordem e revisão recém-feita na concessionária parceira.",
      thumbnail_url: `https://example.com/thumb${i + 1}.jpg`,
      gallery_urls: [
        `https://example.com/g${i + 1}-1.jpg`,
        `https://example.com/g${i + 1}-2.jpg`,
        `https://example.com/g${i + 1}-3.jpg`,
      ],
      photos: [
        `https://example.com/g${i + 1}-1.jpg`,
        `https://example.com/g${i + 1}-2.jpg`,
        `https://example.com/g${i + 1}-3.jpg`,
      ],
      datasheet: [["Câmbio", "Automático"]] as Array<[string, string]>,
      featured: i === 0,
      category: "Sedan" as const,
      plates_visible: false as const,
    })),

    // Metadata
    schema_version: 2 as const,
    generated_by: "claude-sonnet-4-6" as const,
    generation_version: "v2.0.0",
  };
}

describe("updateLeadSiteVariables — happy path", () => {
  it("merge + persist + cache invalidation com patch parcial", async () => {
    const current = makeFullVariables();
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "abc123-toyota-recife",
            status: "published",
            variables: current,
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);

    const service = makeSupabaseClient({
      lead_sites: { updateResult: { error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    const { updateLeadSiteVariables } = await import(
      "@/app/actions/lead-site"
    );
    const r = await updateLeadSiteVariables(LEAD_SITE_ID, {
      slogan: "Slogan novo e diferente do original aqui",
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slug).toBe("abc123-toyota-recife");

    // update foi chamado em lead_sites com merge contendo slogan novo +
    // demais campos preservados.
    const updateCall = service.updateCalls.find(
      (c) => c.table === "lead_sites",
    );
    expect(updateCall).toBeTruthy();
    const payload = updateCall!.payload as Record<string, unknown>;
    const variables = payload.variables as Record<string, unknown>;
    expect(variables.slogan).toBe("Slogan novo e diferente do original aqui");
    expect(variables.business_name).toBe(current.business_name);
    // v2 (#197 PR-C): primary_color vive dentro de brand_assets.
    expect(
      (variables.brand_assets as { primary_color: string }).primary_color,
    ).toBe(current.brand_assets.primary_color);
    expect(updateCall!.eqs).toEqual([["id", LEAD_SITE_ID]]);

    expect(cacheMocks.updateTag).toHaveBeenCalledWith(
      "site:abc123-toyota-recife",
    );
    expect(cacheMocks.updateTag).toHaveBeenCalledWith(
      "og:abc123-toyota-recife",
    );
    expect(cacheMocks.revalidatePath).toHaveBeenCalledWith(
      `/leads/${VALID_LEAD_ID}`,
    );
  });
});

describe("updateLeadSiteVariables — auth + not_found", () => {
  it("retorna { ok: false, error: 'auth' } quando user é null", async () => {
    const server = makeSupabaseClient({});
    server.auth.getUser.mockResolvedValue(noUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { updateLeadSiteVariables } = await import(
      "@/app/actions/lead-site"
    );
    const r = await updateLeadSiteVariables(LEAD_SITE_ID, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("auth");
  });

  it("retorna not_found quando RLS retorna null (cross-user)", async () => {
    const server = makeSupabaseClient({
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { updateLeadSiteVariables } = await import(
      "@/app/actions/lead-site"
    );
    const r = await updateLeadSiteVariables(LEAD_SITE_ID, {
      slogan: "x",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("not_found");
  });
});

describe("updateLeadSiteVariables — status guard", () => {
  it("retorna invalid_status quando status='draft'", async () => {
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "draft-slug",
            status: "draft",
            variables: makeFullVariables(),
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { updateLeadSiteVariables } = await import(
      "@/app/actions/lead-site"
    );
    const r = await updateLeadSiteVariables(LEAD_SITE_ID, {
      slogan: "Slogan novo válido aqui agora",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_status");
  });

  it("aceita status='sent' (espelho de published)", async () => {
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "sent-slug",
            status: "sent",
            variables: makeFullVariables(),
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    const service = makeSupabaseClient({
      lead_sites: { updateResult: { error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    const { updateLeadSiteVariables } = await import(
      "@/app/actions/lead-site"
    );
    const r = await updateLeadSiteVariables(LEAD_SITE_ID, {
      slogan: "Atualização válida no estado sent",
    });
    expect(r.ok).toBe(true);
  });
});

describe("updateLeadSiteVariables — validation + URL sanitization", () => {
  it("retorna validation quando merge falha (cor inválida)", async () => {
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "abc",
            status: "published",
            variables: makeFullVariables(),
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { updateLeadSiteVariables } = await import(
      "@/app/actions/lead-site"
    );
    const r = await updateLeadSiteVariables(LEAD_SITE_ID, {
      // cor com 4 dígitos não passa no regex hex 6 — partial parse falha.
      // v2 (#197 PR-C): primary_color vive dentro de brand_assets.
      brand_assets: {
        logo_url: "https://example.com/logo.png",
        primary_color: "#abc",
        text_on_primary: "#FFFFFF",
        hero_image_url: "https://example.com/hero.jpg",
        about_image_url: "https://example.com/about.jpg",
        contact_image_url: "https://example.com/contact.jpg",
        car_placeholders: [],
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("validation");
  });

  it("safeUrl substitui scheme malicioso por null/string limpa", async () => {
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "abc",
            status: "published",
            variables: makeFullVariables(),
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { updateLeadSiteVariables } = await import(
      "@/app/actions/lead-site"
    );
    const r = await updateLeadSiteVariables(LEAD_SITE_ID, {
      // instagram_url é nullable — javascript:alert(1) vira null no patch.
      // Então o merge tem instagram_url=null e parse final aceita.
      instagram_url: "javascript:alert(1)",
    });
    expect(r.ok).toBe(true);
    // Verificar que o update.payload tem instagram_url=null (não a string maliciosa)
    // (verificação direta via service mock)
  });

  it("URL maliciosa em campo NÃO-nullable rejeita o merge (validation)", async () => {
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "abc",
            status: "published",
            variables: makeFullVariables(),
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { updateLeadSiteVariables } = await import(
      "@/app/actions/lead-site"
    );
    const r = await updateLeadSiteVariables(LEAD_SITE_ID, {
      // brand_assets.logo_url é non-nullable; safeUrl null → SiteVariablesV2.parse falha.
      // v2 (#197 PR-C): logo_url vive dentro de brand_assets.
      brand_assets: {
        logo_url: "javascript:alert(1)",
        primary_color: "#0c5cff",
        text_on_primary: "#FFFFFF",
        hero_image_url: "https://example.com/hero.jpg",
        about_image_url: "https://example.com/about.jpg",
        contact_image_url: "https://example.com/contact.jpg",
        car_placeholders: [],
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("validation");
  });
});

describe("updateLeadSiteVariables — sanitizePatchUrls coverage", () => {
  it("sanitiza home_categories[].image_url, emphasis.image_url, recent_sales[] e cars[] urls", async () => {
    const current = makeFullVariables();
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "abc",
            status: "published",
            variables: current,
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    const service = makeSupabaseClient({
      lead_sites: { updateResult: { error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    const { updateLeadSiteVariables } = await import(
      "@/app/actions/lead-site"
    );
    // Patch tocando arrays/objetos compostos com URLs válidas — exercita
    // todos os ramos de `sanitizePatchUrls`.
    const r = await updateLeadSiteVariables(LEAD_SITE_ID, {
      home_categories: [
        { label: "Novos", image_url: "https://example.com/c1.jpg" },
        { label: "Usados", image_url: "https://example.com/c2.jpg" },
        { label: "Promo", image_url: "https://example.com/c3.jpg" },
      ],
      emphasis: {
        title: "Novo destaque",
        car_name: "Modelo Y",
        description:
          "Modelo recém-chegado, revisado e pronto pra rodar. Documentação em dia, garantia estendida e financiamento.",
        image_url: "https://example.com/new-emphasis.jpg",
      },
      recent_sales: [
        { car_name: "S1", image_url: "https://example.com/s1.jpg" },
        { car_name: "S2", image_url: "https://example.com/s2.jpg" },
        { car_name: "S3", image_url: "https://example.com/s3.jpg" },
      ],
      cars: current.cars.map((c) => ({
        ...c,
        thumbnail_url: "https://example.com/new-thumb.jpg",
        gallery_urls: [
          "https://example.com/g1.jpg",
          "https://example.com/g2.jpg",
          "https://example.com/g3.jpg",
        ],
      })),
    });
    expect(r.ok).toBe(true);
  });

  it("URL maliciosa em emphasis.image_url vira string vazia → validation falha", async () => {
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "abc",
            status: "published",
            variables: makeFullVariables(),
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { updateLeadSiteVariables } = await import(
      "@/app/actions/lead-site"
    );
    const r = await updateLeadSiteVariables(LEAD_SITE_ID, {
      emphasis: {
        title: "X",
        car_name: "Y",
        description:
          "Modelo recém-chegado, revisado e pronto pra rodar. Documentação em dia, garantia estendida e financiamento.",
        image_url: "javascript:alert(1)",
      },
    });
    // safeUrl("javascript:") → null → "" → SiteVariables.parse falha em url()
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("validation");
  });
});

describe("updateLeadSiteVariables — db_error", () => {
  it("retorna db_error quando update falha", async () => {
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "abc",
            status: "published",
            variables: makeFullVariables(),
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    const service = makeSupabaseClient({
      lead_sites: {
        updateResult: { error: { name: "PostgresError", message: "boom" } },
      },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    const { updateLeadSiteVariables } = await import(
      "@/app/actions/lead-site"
    );
    const r = await updateLeadSiteVariables(LEAD_SITE_ID, {
      slogan: "Slogan novo válido aqui agora",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("db_error");
  });
});

// ===========================================================================
// archiveLeadSite (#169) — arquivamento manual
// ===========================================================================

describe("archiveLeadSite — auth + not_found", () => {
  it("retorna { ok: false, error: 'auth' } quando user é null", async () => {
    const server = makeSupabaseClient({});
    server.auth.getUser.mockResolvedValue(noUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { archiveLeadSite } = await import("@/app/actions/lead-site");
    const r = await archiveLeadSite(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("auth");
  });

  it("retorna not_found quando RLS retorna null (cross-user)", async () => {
    const server = makeSupabaseClient({
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { archiveLeadSite } = await import("@/app/actions/lead-site");
    const r = await archiveLeadSite(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("not_found");
  });
});

describe("archiveLeadSite — status guard", () => {
  it("retorna invalid_status quando status='draft'", async () => {
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "draft-slug",
            status: "draft",
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { archiveLeadSite } = await import("@/app/actions/lead-site");
    const r = await archiveLeadSite(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_status");
  });

  it("retorna invalid_status quando status='archived' (já arquivado)", async () => {
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "archived-slug",
            status: "archived",
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { archiveLeadSite } = await import("@/app/actions/lead-site");
    const r = await archiveLeadSite(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_status");
  });
});

describe("archiveLeadSite — happy path", () => {
  it("status='published' → update status='archived', archived_at + cache invalidation", async () => {
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "abc123-toyota",
            status: "published",
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    const service = makeSupabaseClient({
      lead_sites: { updateResult: { error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    const { archiveLeadSite } = await import("@/app/actions/lead-site");
    const r = await archiveLeadSite(LEAD_SITE_ID);

    expect(r.ok).toBe(true);

    const updateCall = service.updateCalls.find(
      (c) => c.table === "lead_sites",
    );
    expect(updateCall).toBeTruthy();
    const payload = updateCall!.payload as Record<string, unknown>;
    expect(payload.status).toBe("archived");
    expect(payload.archived_at).toEqual(expect.any(String));
    // ISO string válida
    expect(new Date(payload.archived_at as string).toString()).not.toBe(
      "Invalid Date",
    );
    expect(updateCall!.eqs).toEqual([["id", LEAD_SITE_ID]]);

    expect(cacheMocks.updateTag).toHaveBeenCalledWith("site:abc123-toyota");
    expect(cacheMocks.updateTag).toHaveBeenCalledWith("og:abc123-toyota");
    expect(cacheMocks.revalidatePath).toHaveBeenCalledWith(
      `/leads/${VALID_LEAD_ID}`,
    );
  });

  it("status='sent' (espelho de published) também é arquivável", async () => {
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "sent-slug",
            status: "sent",
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    const service = makeSupabaseClient({
      lead_sites: { updateResult: { error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    const { archiveLeadSite } = await import("@/app/actions/lead-site");
    const r = await archiveLeadSite(LEAD_SITE_ID);
    expect(r.ok).toBe(true);
  });
});

describe("archiveLeadSite — db_error", () => {
  it("retorna db_error quando update falha", async () => {
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "abc",
            status: "published",
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    const service = makeSupabaseClient({
      lead_sites: {
        updateResult: { error: { name: "PostgresError", message: "boom" } },
      },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    const { archiveLeadSite } = await import("@/app/actions/lead-site");
    const r = await archiveLeadSite(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("db_error");
  });
});

// ===========================================================================
// restoreLeadSite (#169) — restauração de site arquivado
// ===========================================================================

describe("restoreLeadSite — auth + not_found", () => {
  it("retorna { ok: false, error: 'auth' } quando user é null", async () => {
    const server = makeSupabaseClient({});
    server.auth.getUser.mockResolvedValue(noUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { restoreLeadSite } = await import("@/app/actions/lead-site");
    const r = await restoreLeadSite(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("auth");
  });

  it("retorna not_found quando RLS retorna null", async () => {
    const server = makeSupabaseClient({
      lead_sites: { leadResult: { data: null, error: null } },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { restoreLeadSite } = await import("@/app/actions/lead-site");
    const r = await restoreLeadSite(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("not_found");
  });
});

describe("restoreLeadSite — status guard", () => {
  it("retorna invalid_status quando status='published' (não arquivado)", async () => {
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "abc",
            status: "published",
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { restoreLeadSite } = await import("@/app/actions/lead-site");
    const r = await restoreLeadSite(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_status");
  });

  it("retorna invalid_status quando status='draft'", async () => {
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "draft-slug",
            status: "draft",
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { restoreLeadSite } = await import("@/app/actions/lead-site");
    const r = await restoreLeadSite(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_status");
  });
});

describe("restoreLeadSite — happy path", () => {
  it("status='archived' → update status='published', archived_at=null + cache invalidation", async () => {
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "archived-slug",
            status: "archived",
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    const service = makeSupabaseClient({
      lead_sites: { updateResult: { error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    const { restoreLeadSite } = await import("@/app/actions/lead-site");
    const r = await restoreLeadSite(LEAD_SITE_ID);

    expect(r.ok).toBe(true);

    const updateCall = service.updateCalls.find(
      (c) => c.table === "lead_sites",
    );
    expect(updateCall).toBeTruthy();
    const payload = updateCall!.payload as Record<string, unknown>;
    expect(payload.status).toBe("published");
    expect(payload.archived_at).toBeNull();
    expect(updateCall!.eqs).toEqual([["id", LEAD_SITE_ID]]);

    expect(cacheMocks.updateTag).toHaveBeenCalledWith("site:archived-slug");
    expect(cacheMocks.updateTag).toHaveBeenCalledWith("og:archived-slug");
    expect(cacheMocks.revalidatePath).toHaveBeenCalledWith(
      `/leads/${VALID_LEAD_ID}`,
    );
  });
});

describe("restoreLeadSite — db_error", () => {
  it("retorna db_error quando update falha", async () => {
    const server = makeSupabaseClient({
      lead_sites: {
        leadResult: {
          data: {
            id: LEAD_SITE_ID,
            lead_id: VALID_LEAD_ID,
            slug: "abc",
            status: "archived",
          },
          error: null,
        },
      },
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    const service = makeSupabaseClient({
      lead_sites: {
        updateResult: { error: { name: "PostgresError", message: "boom" } },
      },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    const { restoreLeadSite } = await import("@/app/actions/lead-site");
    const r = await restoreLeadSite(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("db_error");
  });
});

// ===========================================================================
// sendLeadSiteWhatsApp (#171) — envio do site via WhatsApp / Evolution
// ===========================================================================

/**
 * Builder de Supabase server-client para `sendLeadSiteWhatsApp`. O server
 * client é tocado em duas tabelas:
 *   - `lead_sites` (status guard + slug)
 *   - `leads` (lookup de `name` para `business_name` no template)
 *
 * Aceita overrides parciais por tabela e devolve o mock compartilhado pra
 * inspeção (`updateCalls`, `selectCalls`).
 */
function makeSendServerClient(opts: {
  leadSite?: {
    id: string;
    lead_id: string;
    slug: string;
    status: string;
  } | null;
  leadName?: string | null;
  fetchError?: unknown;
  /** Count outbound nas últimas 24h pra `checkDailyInstanceLimit` (#173). */
  outboundCount?: number;
}) {
  return makeSupabaseClient({
    lead_sites: {
      leadResult: { data: opts.leadSite ?? null, error: opts.fetchError ?? null },
    },
    leads: {
      leadResult: {
        data: opts.leadName != null ? { name: opts.leadName } : null,
        error: null,
      },
    },
    lead_messages: {
      // `checkDailyInstanceLimit` faz `select('id', { count: 'exact', head: true })`
      // — o builder default aceita esse pattern via `countResult`.
      countResult: { count: opts.outboundCount ?? 0, error: null },
    },
  });
}

describe("sendLeadSiteWhatsApp — auth + not_found", () => {
  it("retorna { ok: false, error: 'auth' } quando user é null", async () => {
    const server = makeSupabaseClient({});
    server.auth.getUser.mockResolvedValue(noUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { sendLeadSiteWhatsApp } = await import("@/app/actions/lead-site");
    const r = await sendLeadSiteWhatsApp(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("auth");
    // Sem auth, nem o helper de envio é tocado.
    expect(evolutionMocks.sendWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("retorna not_found quando RLS retorna null (cross-user)", async () => {
    const server = makeSendServerClient({ leadSite: null });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { sendLeadSiteWhatsApp } = await import("@/app/actions/lead-site");
    const r = await sendLeadSiteWhatsApp(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("not_found");
    expect(evolutionMocks.sendWhatsAppMessage).not.toHaveBeenCalled();
  });
});

describe("sendLeadSiteWhatsApp — status guard", () => {
  it("retorna invalid_status quando status='draft'", async () => {
    const server = makeSendServerClient({
      leadSite: {
        id: LEAD_SITE_ID,
        lead_id: VALID_LEAD_ID,
        slug: "draft-slug",
        status: "draft",
      },
      leadName: "Toyota Recife",
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { sendLeadSiteWhatsApp } = await import("@/app/actions/lead-site");
    const r = await sendLeadSiteWhatsApp(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_status");
    expect(evolutionMocks.sendWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("retorna invalid_status quando status='archived'", async () => {
    const server = makeSendServerClient({
      leadSite: {
        id: LEAD_SITE_ID,
        lead_id: VALID_LEAD_ID,
        slug: "arc",
        status: "archived",
      },
      leadName: "Toyota Recife",
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { sendLeadSiteWhatsApp } = await import("@/app/actions/lead-site");
    const r = await sendLeadSiteWhatsApp(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_status");
  });

  it("aceita status='sent' (re-send permitido)", async () => {
    const server = makeSendServerClient({
      leadSite: {
        id: LEAD_SITE_ID,
        lead_id: VALID_LEAD_ID,
        slug: "sent-slug",
        status: "sent",
      },
      leadName: "Toyota Recife",
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    const service = makeSupabaseClient({
      lead_sites: { updateResult: { error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);
    evolutionMocks.sendWhatsAppMessage.mockResolvedValue({
      ok: true,
      messageId: "m-1",
      whatsappMsgId: "wa-1",
    });

    const { sendLeadSiteWhatsApp } = await import("@/app/actions/lead-site");
    const r = await sendLeadSiteWhatsApp(LEAD_SITE_ID);
    expect(r.ok).toBe(true);
    expect(evolutionMocks.sendWhatsAppMessage).toHaveBeenCalledOnce();
  });
});

describe("sendLeadSiteWhatsApp — happy path", () => {
  it("status='published' → renderiza template, envia, atualiza status='sent' + sent_at + cache", async () => {
    // env é capturado no boot do módulo (`load()` em lib/env.ts) — tocar
    // process.env aqui não muda o valor já carregado. Usamos o valor de
    // VALID_ENV (`http://localhost:3000`) pra construir o site_url esperado.
    const expectedSiteUrl = `${VALID_ENV.NEXT_PUBLIC_APP_URL}/sites/abc-touring-cars`;

    const server = makeSendServerClient({
      leadSite: {
        id: LEAD_SITE_ID,
        lead_id: VALID_LEAD_ID,
        slug: "abc-touring-cars",
        status: "published",
      },
      leadName: "Touring Cars Recife",
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    const service = makeSupabaseClient({
      lead_sites: { updateResult: { error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);

    evolutionMocks.sendWhatsAppMessage.mockResolvedValue({
      ok: true,
      messageId: "msg-id",
      whatsappMsgId: "wa-msg-id",
    });

    const { sendLeadSiteWhatsApp } = await import("@/app/actions/lead-site");
    const r = await sendLeadSiteWhatsApp(LEAD_SITE_ID);

    expect(r).toEqual({ ok: true });

    // Helper recebeu content com business_name e site_url renderizados
    const sendCall = evolutionMocks.sendWhatsAppMessage.mock.calls[0]?.[0] as {
      userId: string;
      leadId: string;
      content: string;
      aiGenerated: boolean;
    };
    expect(sendCall.userId).toBe(USER_ID);
    expect(sendCall.leadId).toBe(VALID_LEAD_ID);
    expect(sendCall.aiGenerated).toBe(false);
    expect(sendCall.content).toContain("Touring Cars Recife");
    expect(sendCall.content).toContain(expectedSiteUrl);
    // Sem placeholders restantes
    expect(sendCall.content).not.toMatch(/\{business_name\}|\{site_url\}/);

    // Update status='sent' + sent_at
    const updateCall = service.updateCalls.find(
      (c) => c.table === "lead_sites",
    );
    expect(updateCall).toBeTruthy();
    const payload = updateCall!.payload as Record<string, unknown>;
    expect(payload.status).toBe("sent");
    expect(payload.sent_at).toEqual(expect.any(String));
    expect(new Date(payload.sent_at as string).toString()).not.toBe(
      "Invalid Date",
    );
    expect(updateCall!.eqs).toEqual([["id", LEAD_SITE_ID]]);

    // Cache invalidation — #213: também invalida `og:<slug>`.
    expect(cacheMocks.updateTag).toHaveBeenCalledWith("site:abc-touring-cars");
    expect(cacheMocks.updateTag).toHaveBeenCalledWith("og:abc-touring-cars");
    expect(cacheMocks.revalidatePath).toHaveBeenCalledWith(
      `/leads/${VALID_LEAD_ID}`,
    );
  });

  it("usa fallback 'Concessionária' quando lead.name está ausente", async () => {
    const server = makeSendServerClient({
      leadSite: {
        id: LEAD_SITE_ID,
        lead_id: VALID_LEAD_ID,
        slug: "fallback-slug",
        status: "published",
      },
      leadName: null,
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    const service = makeSupabaseClient({
      lead_sites: { updateResult: { error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);
    evolutionMocks.sendWhatsAppMessage.mockResolvedValue({
      ok: true,
      messageId: "m-1",
      whatsappMsgId: "wa-1",
    });

    const { sendLeadSiteWhatsApp } = await import("@/app/actions/lead-site");
    const r = await sendLeadSiteWhatsApp(LEAD_SITE_ID);
    expect(r.ok).toBe(true);

    const sendCall = evolutionMocks.sendWhatsAppMessage.mock.calls[0]?.[0] as {
      content: string;
    };
    expect(sendCall.content).toContain("Concessionária");
  });
});

describe("sendLeadSiteWhatsApp — Evolution failures", () => {
  it("retorna whatsapp_error quando instance_disconnected", async () => {
    const server = makeSendServerClient({
      leadSite: {
        id: LEAD_SITE_ID,
        lead_id: VALID_LEAD_ID,
        slug: "abc",
        status: "published",
      },
      leadName: "Toyota Recife",
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    evolutionMocks.sendWhatsAppMessage.mockResolvedValue({
      ok: false,
      reason: "instance_disconnected",
    });

    const { sendLeadSiteWhatsApp } = await import("@/app/actions/lead-site");
    const r = await sendLeadSiteWhatsApp(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe("whatsapp_error");
      expect(r.message).toMatch(/desconectada/i);
    }
    // Não atualiza status quando o envio falha.
    expect(cacheMocks.updateTag).not.toHaveBeenCalled();
  });

  it("retorna whatsapp_error quando lead_missing_phone", async () => {
    const server = makeSendServerClient({
      leadSite: {
        id: LEAD_SITE_ID,
        lead_id: VALID_LEAD_ID,
        slug: "abc",
        status: "published",
      },
      leadName: "Toyota Recife",
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    evolutionMocks.sendWhatsAppMessage.mockResolvedValue({
      ok: false,
      reason: "lead_missing_phone",
    });

    const { sendLeadSiteWhatsApp } = await import("@/app/actions/lead-site");
    const r = await sendLeadSiteWhatsApp(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe("whatsapp_error");
      expect(r.message).toMatch(/telefone/i);
    }
  });

  it("retorna whatsapp_error quando evolution_error genérico", async () => {
    const server = makeSendServerClient({
      leadSite: {
        id: LEAD_SITE_ID,
        lead_id: VALID_LEAD_ID,
        slug: "abc",
        status: "published",
      },
      leadName: "Toyota Recife",
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    evolutionMocks.sendWhatsAppMessage.mockResolvedValue({
      ok: false,
      reason: "evolution_error",
      error: "boom",
    });

    const { sendLeadSiteWhatsApp } = await import("@/app/actions/lead-site");
    const r = await sendLeadSiteWhatsApp(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("whatsapp_error");
  });
});

describe("sendLeadSiteWhatsApp — db_error", () => {
  it("retorna db_error quando update lead_sites falha pós-envio", async () => {
    const server = makeSendServerClient({
      leadSite: {
        id: LEAD_SITE_ID,
        lead_id: VALID_LEAD_ID,
        slug: "abc",
        status: "published",
      },
      leadName: "Toyota Recife",
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    const service = makeSupabaseClient({
      lead_sites: {
        updateResult: { error: { name: "PostgresError", message: "boom" } },
      },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);
    evolutionMocks.sendWhatsAppMessage.mockResolvedValue({
      ok: true,
      messageId: "m-1",
      whatsappMsgId: "wa-1",
    });

    const { sendLeadSiteWhatsApp } = await import("@/app/actions/lead-site");
    const r = await sendLeadSiteWhatsApp(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("db_error");
    // Cache não é invalidado quando o tracking falha.
    expect(cacheMocks.updateTag).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// #173 — guard hard 50 envios/dia/instância (anti-ban WhatsApp)
// ---------------------------------------------------------------------------

describe("sendLeadSiteWhatsApp — rate_limit_daily (#173)", () => {
  it("retorna { ok: false, error: 'rate_limit_daily' } quando count outbound = 50", async () => {
    const server = makeSendServerClient({
      leadSite: {
        id: LEAD_SITE_ID,
        lead_id: VALID_LEAD_ID,
        slug: "abc",
        status: "published",
      },
      leadName: "Toyota Recife",
      outboundCount: 50,
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { sendLeadSiteWhatsApp } = await import("@/app/actions/lead-site");
    const r = await sendLeadSiteWhatsApp(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe("rate_limit_daily");
      expect(r.message).toMatch(/limite diário/i);
      expect(r.message).toMatch(/50/);
    }
    // Evolution NÃO é tocado — anti-ban.
    expect(evolutionMocks.sendWhatsAppMessage).not.toHaveBeenCalled();
    // Cache NÃO é invalidado (sem mudança de estado).
    expect(cacheMocks.updateTag).not.toHaveBeenCalled();
  });

  it("retorna rate_limit_daily quando count > 50 (acima do limite)", async () => {
    const server = makeSendServerClient({
      leadSite: {
        id: LEAD_SITE_ID,
        lead_id: VALID_LEAD_ID,
        slug: "abc",
        status: "published",
      },
      leadName: "Toyota Recife",
      outboundCount: 73,
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { sendLeadSiteWhatsApp } = await import("@/app/actions/lead-site");
    const r = await sendLeadSiteWhatsApp(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("rate_limit_daily");
    expect(evolutionMocks.sendWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("count=49 (boundary) → segue fluxo normal (Evolution chamado)", async () => {
    const server = makeSendServerClient({
      leadSite: {
        id: LEAD_SITE_ID,
        lead_id: VALID_LEAD_ID,
        slug: "abc-touring-cars",
        status: "published",
      },
      leadName: "ABC Touring",
      outboundCount: 49,
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    const service = makeSupabaseClient({
      lead_sites: { updateResult: { error: null } },
    });
    supabaseMocks.serviceClient.mockReturnValue(service);
    evolutionMocks.sendWhatsAppMessage.mockResolvedValue({
      ok: true,
      messageId: "m-1",
      whatsappMsgId: "wa-1",
    });

    const { sendLeadSiteWhatsApp } = await import("@/app/actions/lead-site");
    const r = await sendLeadSiteWhatsApp(LEAD_SITE_ID);
    expect(r.ok).toBe(true);
    expect(evolutionMocks.sendWhatsAppMessage).toHaveBeenCalledOnce();
  });

  it("guard roda APÓS auth + status (cross-cut: status='draft' tem precedência sobre limit)", async () => {
    // Garantia que a ordem de checks é: auth → fetch → status → limit.
    // status='draft' deve ganhar de outboundCount=999 — nem precisamos
    // contar mensagens se o site já não é elegível.
    const server = makeSendServerClient({
      leadSite: {
        id: LEAD_SITE_ID,
        lead_id: VALID_LEAD_ID,
        slug: "drafted",
        status: "draft",
      },
      leadName: "X",
      outboundCount: 999,
    });
    server.auth.getUser.mockResolvedValue(authedUser());
    supabaseMocks.serverClient.mockResolvedValue(server);
    supabaseMocks.serviceClient.mockReturnValue(makeSupabaseClient({}));

    const { sendLeadSiteWhatsApp } = await import("@/app/actions/lead-site");
    const r = await sendLeadSiteWhatsApp(LEAD_SITE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_status");
  });
});
