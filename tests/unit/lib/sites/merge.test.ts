import { describe, expect, it } from "vitest";

import type { AssetSources } from "@/lib/sites/brand-assets.types";
import {
  BUSINESS_NAME_MAX,
  clampBusinessName,
  mergeSiteVariables,
} from "@/lib/sites/merge";
import type { Database } from "@/types/database";
import type { SiteCopy } from "@/types/lead-site";
import { SiteVariables } from "@/types/lead-site";

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
// mergeSiteVariables — happy path + production bug regression
// ---------------------------------------------------------------------------

describe("mergeSiteVariables", () => {
  it("happy path: SiteVariables.parse(merged) passa com fixtures válidas", () => {
    
    const merged = mergeSiteVariables(makeLead(), makeAssets(), makeCopy());
    expect(() => SiteVariables.parse(merged)).not.toThrow();
  });

  it("regression: lead.name com 94 chars (Apify Maps) não quebra parse", () => {
    // Reproduz o bug exato observado em prod (lead 2dc85432-...) que
    // levou ao `SiteVariablesValidationError` em 2026-05-09.
    
    const lead = makeLead({
      name: "Poliguara Car Multimarcas - Venda, Troca e Financiamento de Carros Novos e Semi-Novos. Poá-SP",
    });
    const merged = mergeSiteVariables(lead, makeAssets(), makeCopy());
    const parsed = SiteVariables.parse(merged);
    expect(parsed.business_name).toBe("Poliguara Car Multimarcas");
    expect(parsed.business_name.length).toBeLessThanOrEqual(BUSINESS_NAME_MAX);
  });

  it("phone com formatação variada: produz whatsapp 10-13 dígitos", () => {
    
    const lead = makeLead({
      phone: "+55 11 4380-3858",
      whatsapp: null,
    });
    const merged = mergeSiteVariables(lead, makeAssets(), makeCopy());
    const parsed = SiteVariables.parse(merged);
    expect(parsed.whatsapp).toBe("551143803858");
    expect(parsed.whatsapp).toMatch(/^\d{10,13}$/);
  });

  it("phone com mais de 13 dígitos: clampa pros 13 últimos (E.164 max)", () => {
    
    // 14 dígitos: "12345678901234". Esperado: últimos 13 = "2345678901234".
    const lead = makeLead({
      phone: "+1-234-567-8901-234",
      whatsapp: null,
    });
    const merged = mergeSiteVariables(lead, makeAssets(), makeCopy());
    const parsed = SiteVariables.parse(merged);
    expect(parsed.whatsapp).toBe("2345678901234");
    expect(parsed.whatsapp).toMatch(/^\d{10,13}$/);
  });

  it("instagram_handle null → instagram_url null", () => {
    
    const lead = makeLead({ instagram_handle: null });
    const merged = mergeSiteVariables(lead, makeAssets(), makeCopy());
    const parsed = SiteVariables.parse(merged);
    expect(parsed.instagram_url).toBeNull();
  });

  it("instagram_handle com '@' inicial: strip antes de virar URL", () => {
    
    const lead = makeLead({ instagram_handle: "@autocenter" });
    const merged = mergeSiteVariables(lead, makeAssets(), makeCopy());
    const parsed = SiteVariables.parse(merged);
    expect(parsed.instagram_url).toBe("https://instagram.com/autocenter");
  });

  it("city/state null → address_line null", () => {
    
    const lead = makeLead({ city: null, state: null });
    const merged = mergeSiteVariables(lead, makeAssets(), makeCopy());
    const parsed = SiteVariables.parse(merged);
    expect(parsed.address_line).toBeNull();
  });

  it("email null aceito (schema permite nullable)", () => {
    
    const lead = makeLead({ email: null });
    const merged = mergeSiteVariables(lead, makeAssets(), makeCopy());
    const parsed = SiteVariables.parse(merged);
    expect(parsed.email).toBeNull();
  });

  it("cars[]: 4-6 entries com gallery_urls de 3 elementos", () => {
    
    const merged = mergeSiteVariables(makeLead(), makeAssets(), makeCopy());
    const parsed = SiteVariables.parse(merged);
    expect(parsed.cars.length).toBeGreaterThanOrEqual(4);
    expect(parsed.cars.length).toBeLessThanOrEqual(6);
    for (const car of parsed.cars) {
      expect(car.gallery_urls.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("home_categories sempre length 3, recent_sales sempre length 3", () => {
    
    const merged = mergeSiteVariables(makeLead(), makeAssets(), makeCopy());
    const parsed = SiteVariables.parse(merged);
    expect(parsed.home_categories).toHaveLength(3);
    expect(parsed.recent_sales).toHaveLength(3);
  });

  it("metadata: generated_by literal correto + generation_version não-vazio", () => {
    
    const merged = mergeSiteVariables(makeLead(), makeAssets(), makeCopy());
    const parsed = SiteVariables.parse(merged);
    expect(parsed.generated_by).toBe("claude-sonnet-4-6");
    expect(parsed.generation_version.length).toBeGreaterThan(0);
  });
});
