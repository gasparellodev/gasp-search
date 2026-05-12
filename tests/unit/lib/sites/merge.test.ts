import { describe, expect, it } from "vitest";

import type { AssetSources } from "@/lib/sites/brand-assets.types";
import {
  BUSINESS_NAME_MAX,
  buildAddressFromLead,
  clampBusinessName,
  mergeSiteVariables,
} from "@/lib/sites/merge";
import type { Database } from "@/types/database";
import type { SiteCopy } from "@/types/lead-site";
import { SiteVariablesV2 } from "@/types/lead-site";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

// Envs server-side são setadas globalmente em `vitest.setup.ts` — não
// precisamos repetir aqui. `merge.ts` carrega `generate-copy.ts` →
// `lib/ai/anthropic.ts` → `lib/env.ts` no boot, mas o SDK nunca é
// chamado a partir de `merge.ts` (apenas pure helpers).

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-test-id",
    user_id: "user-test-id",
    source: "google_maps",
    source_search_job_id: null,
    name: "Auto Center Brasil",
    category: "Concessionária",
    city: "Recife",
    state: "PE",
    country: "Brasil",
    phone: "+55 81 99999-1234",
    email: "contato@autocenterbrasil.com.br",
    website: null,
    instagram_handle: "autocenterbrasil",
    whatsapp: null,
    has_website: false,
    rating: 4.8,
    reviews_count: 120,
    followers_count: null,
    stage: "new",
    score: 80,
    notes: null,
    raw: null,
    enriched_at: null,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...overrides,
  };
}

function makeAssets(overrides: Partial<AssetSources> = {}): AssetSources {
  return {
    logo_url: "https://example.com/logo.png",
    primary_color: "#0a0a0a",
    text_on_primary: "#FFFFFF",
    hero_image_url: "https://example.com/hero.png",
    about_image_url: "https://example.com/about.png",
    contact_hero_image_url: "https://example.com/contact.png",
    car_placeholder_urls: [
      "https://example.com/c1.png",
      "https://example.com/c2.png",
      "https://example.com/c3.png",
      "https://example.com/c4.png",
      "https://example.com/c5.png",
      "https://example.com/c6.png",
    ],
    ...overrides,
  };
}

function makeCopy(overrides: Partial<SiteCopy> = {}): SiteCopy {
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
      "Ser referência regional em concessionária familiar, conhecida pela honestidade no negócio e cuidado pós-venda.",
    values: [
      "Honestidade em cada negociação",
      "Respeito pelo cliente",
      "Procedência clara nos veículos",
      "Atendimento humano e direto",
    ],
    cars: [
      {
        description:
          "Sedan compacto bem cuidado, ideal pra cidade. Manutenção em dia, ar-condicionado gelado, direção elétrica e bom espaço interno. Pneus em ótimo estado e revisão preventiva recente.",
        datasheet: [
          ["Câmbio", "Manual"],
          ["Combustível", "Flex"],
        ],
        featured: true,
      },
      {
        description:
          "Hatch ágil e econômico, perfeito pro dia a dia urbano. Vidros elétricos, travas, alarme e som original. Documentação em dia, sem nenhum sinistro registrado no histórico.",
        datasheet: [
          ["Câmbio", "Automático"],
          ["Combustível", "Gasolina"],
        ],
        featured: false,
      },
      {
        description:
          "SUV familiar com ótimo porta-malas e altura elevada. Ar digital, multimídia com câmera de ré, bancos em couro e sensor de estacionamento. Pneus novos, ideal pra viagem.",
        datasheet: [
          ["Câmbio", "Automático"],
          ["Combustível", "Flex"],
        ],
        featured: false,
      },
      {
        description:
          "Picape robusta com tração 4x4, perfeita pra trabalho pesado e fim de semana na fazenda. Caçamba protegida, engate reboque, faróis de neblina e revisão recente.",
        datasheet: [
          ["Câmbio", "Manual"],
          ["Tração", "4x4"],
        ],
        featured: false,
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// clampBusinessName
// ---------------------------------------------------------------------------

describe("clampBusinessName", () => {
  it("retorna o nome inalterado quando ≤ BUSINESS_NAME_MAX", () => {
    expect(clampBusinessName("Auto Center Brasil")).toBe("Auto Center Brasil");
  });

  it("colapsa whitespace duplicado e trim", () => {
    expect(clampBusinessName("  Auto   Center  Brasil  ")).toBe(
      "Auto Center Brasil",
    );
  });

  it("corta no separador ' - ' antes do limite (caso prod Apify Maps)", () => {
    const longName =
      "Poliguara Car Multimarcas - Venda, Troca e Financiamento de Carros Novos e Semi-Novos. Poá-SP";
    expect(longName.length).toBeGreaterThan(BUSINESS_NAME_MAX);
    expect(clampBusinessName(longName)).toBe("Poliguara Car Multimarcas");
  });

  it("corta no ' | ' quando presente antes de outros separadores", () => {
    const longName =
      "Concessionária ABC | Venda, troca e financiamento de carros novos e seminovos com garantia estendida";
    expect(longName.length).toBeGreaterThan(BUSINESS_NAME_MAX);
    expect(clampBusinessName(longName)).toBe("Concessionária ABC");
  });

  it("hard-truncate com ellipsis quando não há separador natural", () => {
    const longName = "A".repeat(120);
    const out = clampBusinessName(longName);
    expect(out.length).toBe(BUSINESS_NAME_MAX);
    expect(out.endsWith("…")).toBe(true);
  });

  it("nunca excede BUSINESS_NAME_MAX em saída", () => {
    const cases = [
      "Curto",
      "A".repeat(80),
      "A".repeat(81),
      "Concessionária com nome bem longo - subtitulo extra que ultrapassa o limite",
      "Sem-separadores-nem-espaços-mas-muito-longo-pra-passar-do-limite-de-oitenta-chars",
    ];
    for (const c of cases) {
      const out = clampBusinessName(c);
      expect(out.length).toBeLessThanOrEqual(BUSINESS_NAME_MAX);
    }
  });
});

// ---------------------------------------------------------------------------
// buildAddressFromLead
// ---------------------------------------------------------------------------

describe("buildAddressFromLead", () => {
  it("retorna null quando lead.city é null", () => {
    expect(buildAddressFromLead(makeLead({ city: null }))).toBeNull();
  });

  it("retorna null quando lead.state é null", () => {
    expect(buildAddressFromLead(makeLead({ state: null }))).toBeNull();
  });

  it("retorna null mesmo com city/state válidos (V1 admin completa)", () => {
    // Decisão #197 PR-C: Apify Maps não traz street/number/neighborhood/zip
    // estruturados — retornar null evita crash em SiteVariablesV2.parse.
    // Admin completa via LeadSiteEditModal.
    expect(buildAddressFromLead(makeLead())).toBeNull();
  });

  it("retorna null para state inválido (não-UF)", () => {
    expect(buildAddressFromLead(makeLead({ state: "Pernambuco" }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mergeSiteVariables — happy path + production bug regression
// ---------------------------------------------------------------------------

describe("mergeSiteVariables — shape v2", () => {
  it("happy path: SiteVariablesV2.parse(merged) passa com fixtures válidas", () => {
    const merged = mergeSiteVariables(makeLead(), makeAssets(), makeCopy());
    const result = SiteVariablesV2.safeParse(merged);
    if (!result.success) {
      // Surface specific issues to help debug if test fails.
      throw new Error(
        `SiteVariablesV2.parse failed: ${result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.code} (${i.message})`)
          .join("; ")}`,
      );
    }
    expect(result.success).toBe(true);
  });

  it("schema_version literal 2", () => {
    const merged = mergeSiteVariables(makeLead(), makeAssets(), makeCopy()) as {
      schema_version: number;
    };
    expect(merged.schema_version).toBe(2);
  });

  it("brand_assets nested com 6 campos canônicos + car_placeholders", () => {
    const merged = mergeSiteVariables(makeLead(), makeAssets(), makeCopy()) as {
      brand_assets: {
        logo_url: string;
        primary_color: string;
        text_on_primary: string;
        hero_image_url: string;
        about_image_url: string;
        contact_image_url: string;
        car_placeholders: string[];
      };
    };
    expect(merged.brand_assets.logo_url).toBe("https://example.com/logo.png");
    expect(merged.brand_assets.primary_color).toBe("#0a0a0a");
    expect(merged.brand_assets.text_on_primary).toBe("#FFFFFF");
    expect(merged.brand_assets.hero_image_url).toBe(
      "https://example.com/hero.png",
    );
    expect(merged.brand_assets.about_image_url).toBe(
      "https://example.com/about.png",
    );
    // Renomeio v1→v2: contact_hero_image_url → contact_image_url
    expect(merged.brand_assets.contact_image_url).toBe(
      "https://example.com/contact.png",
    );
    expect(merged.brand_assets.car_placeholders).toHaveLength(6);
  });

  it("address: null quando lead não tem city/state válidos", () => {
    const merged = mergeSiteVariables(
      makeLead({ city: null, state: null }),
      makeAssets(),
      makeCopy(),
    ) as { address: unknown };
    expect(merged.address).toBeNull();
  });

  it("address: null mesmo com city/state V1 (admin completa via modal)", () => {
    const merged = mergeSiteVariables(makeLead(), makeAssets(), makeCopy()) as {
      address: unknown;
    };
    expect(merged.address).toBeNull();
  });

  it("nenhum campo flat v1 (address_line, hero_image_url top-level, etc)", () => {
    const merged = mergeSiteVariables(
      makeLead(),
      makeAssets(),
      makeCopy(),
    ) as Record<string, unknown>;
    // Esses keys devem ter saído pra dentro de brand_assets/address.
    expect("address_line" in merged).toBe(false);
    expect("hero_image_url" in merged).toBe(false);
    expect("about_image_url" in merged).toBe(false);
    expect("contact_hero_image_url" in merged).toBe(false);
    expect("primary_color" in merged).toBe(false);
    expect("text_on_primary" in merged).toBe(false);
    expect("logo_url" in merged).toBe(false);
  });

  it("regression: lead.name com 94 chars (Apify Maps) não quebra parse", () => {
    const lead = makeLead({
      name: "Poliguara Car Multimarcas - Venda, Troca e Financiamento de Carros Novos e Semi-Novos. Poá-SP",
    });
    const merged = mergeSiteVariables(lead, makeAssets(), makeCopy());
    const parsed = SiteVariablesV2.parse(merged);
    expect(parsed.business_name).toBe("Poliguara Car Multimarcas");
    expect(parsed.business_name.length).toBeLessThanOrEqual(BUSINESS_NAME_MAX);
  });

  it("phone com formatação variada: produz whatsapp 10-13 dígitos", () => {
    const lead = makeLead({
      phone: "+55 11 4380-3858",
      whatsapp: null,
    });
    const merged = mergeSiteVariables(lead, makeAssets(), makeCopy());
    const parsed = SiteVariablesV2.parse(merged);
    expect(parsed.whatsapp).toBe("551143803858");
    expect(parsed.whatsapp).toMatch(/^\d{10,13}$/);
  });

  it("phone com mais de 13 dígitos: clampa pros 13 últimos (E.164 max)", () => {
    const lead = makeLead({
      phone: "+1-234-567-8901-234",
      whatsapp: null,
    });
    const merged = mergeSiteVariables(lead, makeAssets(), makeCopy());
    const parsed = SiteVariablesV2.parse(merged);
    expect(parsed.whatsapp).toBe("2345678901234");
    expect(parsed.whatsapp).toMatch(/^\d{10,13}$/);
  });

  it("instagram_handle null → instagram_url null", () => {
    const lead = makeLead({ instagram_handle: null });
    const merged = mergeSiteVariables(lead, makeAssets(), makeCopy());
    const parsed = SiteVariablesV2.parse(merged);
    expect(parsed.instagram_url).toBeNull();
  });

  it("instagram_handle com '@' inicial: strip antes de virar URL", () => {
    const lead = makeLead({ instagram_handle: "@autocenter" });
    const merged = mergeSiteVariables(lead, makeAssets(), makeCopy());
    const parsed = SiteVariablesV2.parse(merged);
    expect(parsed.instagram_url).toBe("https://instagram.com/autocenter");
  });

  it("email null aceito (schema permite nullable)", () => {
    const lead = makeLead({ email: null });
    const merged = mergeSiteVariables(lead, makeAssets(), makeCopy());
    const parsed = SiteVariablesV2.parse(merged);
    expect(parsed.email).toBeNull();
  });

  it("cars[]: 4-6 entries com photos[] length 3 + plates_visible false", () => {
    const merged = mergeSiteVariables(makeLead(), makeAssets(), makeCopy());
    const parsed = SiteVariablesV2.parse(merged);
    expect(parsed.cars.length).toBeGreaterThanOrEqual(4);
    expect(parsed.cars.length).toBeLessThanOrEqual(6);
    for (const car of parsed.cars) {
      expect(car.photos).toBeDefined();
      expect(car.photos!.length).toBeGreaterThanOrEqual(3);
      expect(car.plates_visible).toBe(false);
      expect(car.category).toBe("Sedan");
    }
  });

  it("cars[] novos recebem slug SEO-friendly com sufixo id4", () => {
    const merged = mergeSiteVariables(makeLead(), makeAssets(), makeCopy());
    const parsed = SiteVariablesV2.parse(merged);

    expect(parsed.cars[0]?.slug).toMatch(
      /^auto-modelo-1-\d{4}-[a-f0-9]{4}$/,
    );
    expect(parsed.cars[1]?.slug).toMatch(
      /^auto-modelo-2-\d{4}-[a-f0-9]{4}$/,
    );
  });

  it("home_categories sempre length 3, recent_sales sempre length 3", () => {
    const merged = mergeSiteVariables(makeLead(), makeAssets(), makeCopy());
    const parsed = SiteVariablesV2.parse(merged);
    expect(parsed.home_categories).toHaveLength(3);
    expect(parsed.recent_sales).toHaveLength(3);
  });

  it("metadata: generated_by literal correto + generation_version + schema_version 2", () => {
    const merged = mergeSiteVariables(makeLead(), makeAssets(), makeCopy());
    const parsed = SiteVariablesV2.parse(merged);
    expect(parsed.generated_by).toBe("claude-sonnet-4-6");
    expect(parsed.generation_version.length).toBeGreaterThan(0);
    expect(parsed.schema_version).toBe(2);
  });
});
