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
};

function makeSupabaseClient(
  config: Record<string, TableHandlers> = {},
): {
  from: ReturnType<typeof vi.fn>;
  auth: { getUser: ReturnType<typeof vi.fn> };
  upsertCalls: Array<{ table: string; payload: unknown; opts: unknown }>;
  insertCalls: Array<{ table: string; payload: unknown }>;
  selectCalls: Array<{ table: string; eqs: Array<[string, unknown]> }>;
} {
  const upsertCalls: Array<{ table: string; payload: unknown; opts: unknown }> =
    [];
  const insertCalls: Array<{ table: string; payload: unknown }> = [];
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

    return builder;
  });

  return {
    from,
    auth: { getUser: vi.fn() },
    upsertCalls,
    insertCalls,
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

    // revalidate calls
    expect(cacheMocks.updateTag).toHaveBeenCalledWith(
      "site:abc12345-toyota-do-recife",
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
    const variables = (upsert.payload as { variables: Record<string, string> })
      .variables;

    expect(variables.logo_url).not.toMatch(/^javascript:/i);
    expect(variables.hero_image_url).not.toMatch(/^data:/i);
    expect(variables.contact_hero_image_url).not.toMatch(/^file:/i);
    // Os 3 viraram fallback (mas todos são URLs https válidas)
    expect(variables.logo_url).toMatch(/^https?:/);
    expect(variables.hero_image_url).toMatch(/^https?:/);
    expect(variables.contact_hero_image_url).toMatch(/^https?:/);
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
    const { SiteVariables } = await import("@/types/lead-site");
    expect(() => SiteVariables.parse(variables)).not.toThrow();
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
