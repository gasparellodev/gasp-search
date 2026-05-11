/**
 * Tests para `lib/sites/visual-identity.ts` (Phase 7 Sprint 2 #A2, #216).
 *
 * Cobre:
 *   - `ALL_ASSET_SPECS`: 9 entries (3 hero/about/contact + 6 categories).
 *   - `buildAssetSpecsForCars`: filtra categorias presentes; fallback Sedan.
 *   - `buildPrompt`: interpolação + anti-hallucination clause snapshot-locked.
 *   - `buildIdentityContext`: v1 e v2 SiteVariables shapes, fallbacks.
 *   - `estimateTotalCost`: USD+BRL conversion ($0.49 ± $0.05 com 9 specs).
 *   - `uploadAssetToStorage`: mock Storage success/error + path correto.
 *   - `deleteExistingAssets`: mock list+remove; idempotent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_ENV = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  APIFY_TOKEN: "t",
  APIFY_GOOGLE_MAPS_ACTOR_ID: "a",
  APIFY_INSTAGRAM_ACTOR_ID: "i",
  APIFY_WEBSITE_CONTACT_ACTOR_ID: "w",
  ANTHROPIC_API_KEY: "sk-ant-test",
  ANTHROPIC_MODEL: "claude-sonnet-4-6",
  OPENAI_API_KEY: "sk-openai-test",
  OPENAI_IMAGE_MODEL: "gpt-image-2-2026-04-21",
  OPENAI_IMAGE_FALLBACK_MODEL: "gpt-image-1-mini",
  OPENAI_IMAGE_CONCURRENCY: "2",
  BRL_RATE: "5.0",
} as const;

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  Object.assign(process.env, VALID_ENV);
});

afterEach(() => {
  process.env = savedEnv;
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// ALL_ASSET_SPECS — 9 entries
// ---------------------------------------------------------------------------

describe("ALL_ASSET_SPECS", () => {
  it("contém exatamente 9 entries (1 hero + 6 categories + 1 about + 1 contact)", async () => {
    const { ALL_ASSET_SPECS } = await import("@/lib/sites/visual-identity");
    expect(ALL_ASSET_SPECS).toHaveLength(9);
  });

  it("inclui hero, about, contact (1536x1024 medium)", async () => {
    const { ALL_ASSET_SPECS } = await import("@/lib/sites/visual-identity");
    const hero = ALL_ASSET_SPECS.find((s) => s.key === "hero")!;
    expect(hero.size).toBe("1536x1024");
    expect(hero.quality).toBe("medium");
    expect(hero.manifestField).toBe("hero_url");

    expect(ALL_ASSET_SPECS.find((s) => s.key === "about")?.size).toBe(
      "1536x1024",
    );
    expect(ALL_ASSET_SPECS.find((s) => s.key === "contact")?.size).toBe(
      "1536x1024",
    );
  });

  it("inclui 6 categorias (1024x1024 medium)", async () => {
    const { ALL_ASSET_SPECS } = await import("@/lib/sites/visual-identity");
    const cats = ALL_ASSET_SPECS.filter(
      (s) => s.manifestField === "categories_urls",
    );
    expect(cats).toHaveLength(6);
    for (const c of cats) {
      expect(c.size).toBe("1024x1024");
      expect(c.quality).toBe("medium");
    }
  });
});

// ---------------------------------------------------------------------------
// buildAssetSpecsForCars
// ---------------------------------------------------------------------------

describe("buildAssetSpecsForCars", () => {
  it("inclui sempre hero/about/contact + categorias presentes", async () => {
    const { buildAssetSpecsForCars } = await import(
      "@/lib/sites/visual-identity"
    );
    const cars = [
      { category: "SUV" as const },
      { category: "Sedan" as const },
      { category: "Sedan" as const }, // dup ignored
    ];
    const specs = buildAssetSpecsForCars(cars);
    const keys = specs.map((s) => s.key);
    expect(keys).toContain("hero");
    expect(keys).toContain("about");
    expect(keys).toContain("contact");
    expect(keys).toContain("category_suv");
    expect(keys).toContain("category_sedan");
    expect(keys).not.toContain("category_hatch");
    expect(specs).toHaveLength(5); // 3 fixed + 2 categories
  });

  it("inclui todas 6 categorias se cars têm todos os tipos", async () => {
    const { buildAssetSpecsForCars } = await import(
      "@/lib/sites/visual-identity"
    );
    const cars = [
      { category: "SUV" as const },
      { category: "Sedan" as const },
      { category: "Hatch" as const },
      { category: "Pickup" as const },
      { category: "Esportivo" as const },
      { category: "Conversível" as const },
    ];
    const specs = buildAssetSpecsForCars(cars);
    expect(specs).toHaveLength(9);
  });

  it("fallback Sedan quando nenhum car tem `category`", async () => {
    const { buildAssetSpecsForCars } = await import(
      "@/lib/sites/visual-identity"
    );
    const cars = [{}, {}, {}]; // v1-legacy cars sem category
    const specs = buildAssetSpecsForCars(cars);
    expect(specs.find((s) => s.key === "category_sedan")).toBeTruthy();
    expect(specs).toHaveLength(4); // 3 fixed + 1 fallback Sedan
  });

  it("ignora category strings inválidas (defensive)", async () => {
    const { buildAssetSpecsForCars } = await import(
      "@/lib/sites/visual-identity"
    );
    const cars = [{ category: "FooBar" }, { category: "SUV" as const }];
    const specs = buildAssetSpecsForCars(cars);
    expect(specs.find((s) => s.key === "category_suv")).toBeTruthy();
    expect(specs).toHaveLength(4); // 3 fixed + 1 SUV
  });

  it("re-indexa categoryIndex sequencialmente (sparse → dense)", async () => {
    const { buildAssetSpecsForCars } = await import(
      "@/lib/sites/visual-identity"
    );
    const cars = [
      { category: "Hatch" as const },
      { category: "Conversível" as const },
    ];
    const specs = buildAssetSpecsForCars(cars);
    const cats = specs.filter((s) => s.manifestField === "categories_urls");
    expect(cats).toHaveLength(2);
    expect(cats[0]?.categoryIndex).toBe(0);
    expect(cats[1]?.categoryIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// buildPrompt — interpolação + anti-hallucination clause
// ---------------------------------------------------------------------------

describe("buildPrompt", () => {
  it("interpola business_name, city_state, primary_color", async () => {
    const { buildPrompt, ALL_ASSET_SPECS } = await import(
      "@/lib/sites/visual-identity"
    );
    const hero = ALL_ASSET_SPECS.find((s) => s.key === "hero")!;
    const prompt = buildPrompt(hero, {
      business_name: "Sertão Motors",
      city: "Petrolina",
      state: "PE",
      primary_color: "#ff6b00",
    });
    expect(prompt).toContain("Sertão Motors");
    expect(prompt).toContain("Petrolina, PE");
    expect(prompt).toContain("#ff6b00");
  });

  it("usa 'Brasil' quando city e state null", async () => {
    const { buildPrompt, ALL_ASSET_SPECS } = await import(
      "@/lib/sites/visual-identity"
    );
    const hero = ALL_ASSET_SPECS.find((s) => s.key === "hero")!;
    const prompt = buildPrompt(hero, {
      business_name: "X",
      city: null,
      state: null,
      primary_color: "#000000",
    });
    expect(prompt).toContain("Brasil");
    expect(prompt).not.toContain("undefined");
    expect(prompt).not.toContain("null");
  });

  it("anti-hallucination clause presente em TODOS os templates", async () => {
    const {
      buildPrompt,
      ALL_ASSET_SPECS,
      ANTI_HALLUCINATION_CLAUSE,
    } = await import("@/lib/sites/visual-identity");
    const ctx = {
      business_name: "X",
      city: "São Paulo",
      state: "SP",
      primary_color: "#000",
    };
    for (const spec of ALL_ASSET_SPECS) {
      const prompt = buildPrompt(spec, ctx);
      expect(prompt).toContain(ANTI_HALLUCINATION_CLAUSE);
    }
  });

  it("anti-hallucination clause snapshot — bloqueia drift (text/logos/plates/brands)", async () => {
    const { ANTI_HALLUCINATION_CLAUSE } = await import(
      "@/lib/sites/visual-identity"
    );
    // Snapshot-locked: qualquer mudança requer revisão consciente.
    expect(ANTI_HALLUCINATION_CLAUSE).toMatchInlineSnapshot(
      `"Do NOT include any of the following: text, words, letters, numbers, logos, brand marks, license plates, watermarks, recognizable brand badges (BMW/Toyota/Honda/Ford/etc — use generic silhouettes only), human faces, copyrighted iconography, dealer signage, or any readable typography."`,
    );
  });

  it("templates não vazam variáveis literais (`{{...}}`)", async () => {
    const { buildPrompt, ALL_ASSET_SPECS } = await import(
      "@/lib/sites/visual-identity"
    );
    const ctx = {
      business_name: "X",
      city: "SP",
      state: "SP",
      primary_color: "#000",
    };
    for (const spec of ALL_ASSET_SPECS) {
      const prompt = buildPrompt(spec, ctx);
      expect(prompt).not.toContain("{{");
      expect(prompt).not.toContain("}}");
    }
  });
});

// ---------------------------------------------------------------------------
// buildIdentityContext — v1 e v2 SiteVariables shapes
// ---------------------------------------------------------------------------

describe("buildIdentityContext", () => {
  it("extrai contexto de SiteVariables v2 (nested address + brand_assets)", async () => {
    const { buildIdentityContext } = await import(
      "@/lib/sites/visual-identity"
    );
    const ctx = buildIdentityContext({
      business_name: "AutoForte",
      address: {
        street: "Av X",
        number: "100",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
        zip: "01000-000",
        country: "BR",
      },
      brand_assets: { primary_color: "#0071e3" },
    });
    expect(ctx.business_name).toBe("AutoForte");
    expect(ctx.city).toBe("São Paulo");
    expect(ctx.state).toBe("SP");
    expect(ctx.primary_color).toBe("#0071e3");
  });

  it("extrai contexto de SiteVariables v1 (flat — city/state null, primary_color flat)", async () => {
    const { buildIdentityContext } = await import(
      "@/lib/sites/visual-identity"
    );
    const ctx = buildIdentityContext({
      business_name: "AutoLegado",
      primary_color: "#cc0000",
      address_line: "Rua Tal, 123, Centro, SP",
    });
    expect(ctx.business_name).toBe("AutoLegado");
    expect(ctx.city).toBeNull();
    expect(ctx.state).toBeNull();
    expect(ctx.primary_color).toBe("#cc0000");
  });

  it("fallback primary_color = #0c0c0c (preto neutro) se ausente em ambos shapes", async () => {
    const { buildIdentityContext } = await import(
      "@/lib/sites/visual-identity"
    );
    const ctx = buildIdentityContext({ business_name: "X" });
    expect(ctx.primary_color).toBe("#0c0c0c");
  });

  it("lança se business_name vazio/ausente", async () => {
    const { buildIdentityContext } = await import(
      "@/lib/sites/visual-identity"
    );
    expect(() => buildIdentityContext({})).toThrow();
    expect(() => buildIdentityContext({ business_name: "   " })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// estimateTotalCost — $0.49 ± $0.05 target
// ---------------------------------------------------------------------------

describe("estimateTotalCost", () => {
  it("9 specs com modelo default → ~$0.441 USD (3×$0.063 + 6×$0.042)", async () => {
    const { estimateTotalCost, ALL_ASSET_SPECS } = await import(
      "@/lib/sites/visual-identity"
    );
    const cost = estimateTotalCost(ALL_ASSET_SPECS);
    // 3 × 0.063 = 0.189 + 6 × 0.042 = 0.252 → 0.441
    expect(cost.usd).toBeCloseTo(0.441, 3);
    // BRL = 0.441 × 5.0 = 2.205, rounded to 2 decimals = 2.2 (banker-half).
    expect(cost.brl).toBeCloseTo(2.2, 1);
  });

  it("cost está dentro do target $0.49 USD ± $0.05 (snapshot-locked)", async () => {
    const { estimateTotalCost, ALL_ASSET_SPECS } = await import(
      "@/lib/sites/visual-identity"
    );
    const cost = estimateTotalCost(ALL_ASSET_SPECS);
    expect(cost.usd).toBeGreaterThan(0.39);
    expect(cost.usd).toBeLessThan(0.5);
  });

  it("fallback gpt-image-1-mini reduz custo significativamente", async () => {
    const { estimateTotalCost, ALL_ASSET_SPECS } = await import(
      "@/lib/sites/visual-identity"
    );
    const primaryCost = estimateTotalCost(ALL_ASSET_SPECS);
    const fallbackCost = estimateTotalCost(
      ALL_ASSET_SPECS,
      "gpt-image-1-mini",
    );
    expect(fallbackCost.usd).toBeLessThan(primaryCost.usd * 0.5);
  });

  it("usa env.BRL_RATE para conversão (4.5 → custo BRL menor)", async () => {
    vi.resetModules();
    process.env.BRL_RATE = "4.5";
    const { estimateTotalCost, ALL_ASSET_SPECS } = await import(
      "@/lib/sites/visual-identity"
    );
    const cost = estimateTotalCost(ALL_ASSET_SPECS);
    // 0.441 × 4.5 = 1.9845 ≈ 1.98
    expect(cost.brl).toBeCloseTo(1.98, 2);
  });
});

// ---------------------------------------------------------------------------
// uploadAssetToStorage — service_role mock
// ---------------------------------------------------------------------------

function makeStorageMock(opts: {
  uploadError?: unknown;
  publicUrl?: string;
  listResult?: { data: Array<{ name: string }> | null; error: unknown };
  removeError?: unknown;
} = {}) {
  const uploadSpy = vi.fn().mockResolvedValue({ error: opts.uploadError ?? null });
  const getPublicUrlSpy = vi.fn().mockReturnValue({
    data: { publicUrl: opts.publicUrl ?? "https://cdn.test/x.png" },
  });
  const listSpy = vi
    .fn()
    .mockResolvedValue(opts.listResult ?? { data: [], error: null });
  const removeSpy = vi.fn().mockResolvedValue({ error: opts.removeError ?? null });

  const fromBucket = vi.fn(() => ({
    upload: uploadSpy,
    getPublicUrl: getPublicUrlSpy,
    list: listSpy,
    remove: removeSpy,
  }));

  return {
    storage: { from: fromBucket },
    spies: { uploadSpy, getPublicUrlSpy, listSpy, removeSpy, fromBucket },
  };
}

describe("uploadAssetToStorage", () => {
  it("uploads PNG b64 ao bucket visual-identity e retorna URL pública", async () => {
    const { uploadAssetToStorage } = await import(
      "@/lib/sites/visual-identity"
    );
    const mock = makeStorageMock({ publicUrl: "https://cdn.test/hero.png" });
    const url = await uploadAssetToStorage({
      b64: "aGVsbG8=", // "hello" base64
      slug: "abc-toyota",
      key: "hero",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: mock as any,
    });
    expect(url).toBe("https://cdn.test/hero.png");

    expect(mock.spies.fromBucket).toHaveBeenCalledWith("visual-identity");
    expect(mock.spies.uploadSpy).toHaveBeenCalledTimes(1);
    const [pathArg, bufferArg, optsArg] = mock.spies.uploadSpy.mock.calls[0]!;
    expect(pathArg).toMatch(/^abc-toyota\/hero-\d+\.png$/);
    expect(bufferArg).toBeInstanceOf(Buffer);
    expect(optsArg).toEqual({ contentType: "image/png", upsert: true });
  });

  it("lança erro se upload falhar", async () => {
    const { uploadAssetToStorage } = await import(
      "@/lib/sites/visual-identity"
    );
    const mock = makeStorageMock({ uploadError: { message: "Quota exceeded" } });
    await expect(
      uploadAssetToStorage({
        b64: "aGVsbG8=",
        slug: "abc",
        key: "hero",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase: mock as any,
      }),
    ).rejects.toThrow(/Quota exceeded/);
  });
});

// ---------------------------------------------------------------------------
// deleteExistingAssets — idempotent
// ---------------------------------------------------------------------------

describe("deleteExistingAssets", () => {
  it("lista + remove arquivos do bucket; no-op se vazio", async () => {
    const { deleteExistingAssets } = await import(
      "@/lib/sites/visual-identity"
    );
    const mock = makeStorageMock({ listResult: { data: [], error: null } });
    await deleteExistingAssets("abc", mock as never);
    expect(mock.spies.listSpy).toHaveBeenCalledWith("abc");
    expect(mock.spies.removeSpy).not.toHaveBeenCalled();
  });

  it("remove todos os paths listados", async () => {
    const { deleteExistingAssets } = await import(
      "@/lib/sites/visual-identity"
    );
    const mock = makeStorageMock({
      listResult: {
        data: [{ name: "hero-1.png" }, { name: "about-1.png" }],
        error: null,
      },
    });
    await deleteExistingAssets("xyz", mock as never);
    expect(mock.spies.removeSpy).toHaveBeenCalledWith([
      "xyz/hero-1.png",
      "xyz/about-1.png",
    ]);
  });

  it("lança erro se list falhar", async () => {
    const { deleteExistingAssets } = await import(
      "@/lib/sites/visual-identity"
    );
    const mock = makeStorageMock({
      listResult: { data: null, error: { message: "Access denied" } },
    });
    await expect(
      deleteExistingAssets("abc", mock as never),
    ).rejects.toThrow(/Access denied/);
  });

  it("lança erro se remove falhar", async () => {
    const { deleteExistingAssets } = await import(
      "@/lib/sites/visual-identity"
    );
    const mock = makeStorageMock({
      listResult: { data: [{ name: "hero-1.png" }], error: null },
      removeError: { message: "Permission error" },
    });
    await expect(
      deleteExistingAssets("abc", mock as never),
    ).rejects.toThrow(/Permission error/);
  });
});
