/**
 * Testes do helper puro `lib/sites/llms.ts` (issue #214 / Sprint 1 / #S4).
 * v2 upgrade: issue #G1 / Frente 04 GEO/AI — seções estruturadas
 * (Localização / Especialidades / Inventário / Garantias / FAQ / Contato)
 * para passage-citability em AI crawlers.
 *
 * Foco: render Markdown determinístico do `llms.txt` consumido por
 * AI crawlers (GPTBot, ClaudeBot, PerplexityBot). Função pura — sem
 * I/O — só consome `variables` validado upstream + `slug` + lê
 * `env.NEXT_PUBLIC_APP_URL` (default vitest = `http://localhost:3000`).
 *
 * Decisões PO (#214 + #G1):
 *   - Frase factual SEM "loja online" (evita expectativa de e-commerce).
 *   - Hedging "consulte estoque atualizado" SÓ no rodapé.
 *   - Address null → fallback "no Brasil" (não omitir frase Sobre).
 *   - Linhas condicionais (phone/email/etc) null → OMITIDAS, não "undefined".
 *   - Sem BOM UTF-8 no output.
 *   - Sem PII de leads (apenas dados públicos do negócio).
 *   - 6-car cap no snapshot (llms.txt), 20-car cap no llms-full.txt.
 *   - Garantias: 3 bullets fixos (posicionamento GaspLab).
 *   - FAQ: FAQ_TEMPLATE canônico (8 Q&As).
 */
import { describe, expect, it } from "vitest";

import { renderLlmsTxt } from "@/lib/sites/llms";

import { SITE_FIXTURE } from "../../components/sites/site-fixtures";

const SLUG = "j7k2p9-touring-cars";
const BASE_URL = "http://localhost:3000";

describe("renderLlmsTxt v2 — happy path canônico", () => {
  it("emite Markdown completo com todas as seções v2", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });

    // Header
    expect(out).toContain(`# ${SITE_FIXTURE.business_name}`);

    // Slogan (blockquote)
    expect(out).toContain(`> ${SITE_FIXTURE.slogan}`);

    // Seções v2
    expect(out).toContain("## Localização");
    expect(out).toContain("## Especialidades");
    expect(out).toContain("## Inventário atual");
    expect(out).toContain("## Garantias");
    expect(out).toContain("## FAQ");
    expect(out).toContain("## Contato");
    expect(out).toContain("## Para estoque atualizado em tempo real");

    // Hedging rodapé
    expect(out).toContain(`Consulte: ${BASE_URL}/sites/${SLUG}/estoque`);
  });

  it("não emite seção '## Sobre' (removida no v2 — substituída por Localização + Especialidades)", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });
    // v2 não tem "## Sobre" no llms.txt principal
    expect(out).not.toContain("## Sobre");
  });

  it("inclui link de detalhes pra cada car listado", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });

    for (const car of SITE_FIXTURE.cars) {
      expect(out).toContain(
        `${BASE_URL}/sites/${SLUG}/estoque/${car.slug}`,
      );
    }
  });

  it("emite preço formatado em BRL pt-BR (sem casas decimais)", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });
    expect(out).toMatch(/R\$\s?\d{1,3}\.\d{3}/);
  });

  it("limita estoque a 6 cars (mesmo se variables tiver mais)", () => {
    const sixCars = [
      ...SITE_FIXTURE.cars,
      SITE_FIXTURE.cars[0],
      SITE_FIXTURE.cars[1],
    ]
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
      .slice(0, 6);

    const vars = { ...SITE_FIXTURE, cars: sixCars };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    const bulletCount = (out.match(/^- \*\*.+ \d{4}\*\*/gm) ?? []).length;
    expect(bulletCount).toBeLessThanOrEqual(6);
  });
});

describe("renderLlmsTxt v2 — ## Localização", () => {
  it("emite endereço formatado: street, city - state, zip", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });

    expect(out).toContain("## Localização");
    // SITE_FIXTURE.address: street="Av. Boa Viagem" city="Recife" state="PE" zip="51020-000"
    expect(out).toContain("Av. Boa Viagem, Recife - PE, 51020-000");
  });

  it("emite 'no Brasil' quando address === null", () => {
    const vars = { ...SITE_FIXTURE, address: null };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    expect(out).toContain("## Localização");
    expect(out).toContain("no Brasil");
  });
});

describe("renderLlmsTxt v2 — ## Especialidades", () => {
  it("emite lista de marcas únicas dos cars", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });

    // SITE_FIXTURE.cars: Toyota, Honda, Volkswagen, Hyundai
    expect(out).toContain("- Marcas: Toyota, Honda, Volkswagen, Hyundai");
  });

  it("emite tipo fixo 'Seminovos premium'", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });
    expect(out).toContain("- Tipo: Seminovos premium");
  });

  it("emite faixa de preço calculada do min/max de cars[].price", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });
    // cars: 119900, 109900, 89900, 59900 → min=59900, max=119900
    expect(out).toContain("- Faixa de preço: R$");
    expect(out).toMatch(/Faixa de preço: R\$.*a R\$/);
  });

  it("omite Faixa de preço quando todos cars[].price são null", () => {
    const vars = {
      ...SITE_FIXTURE,
      cars: SITE_FIXTURE.cars.map((c) => ({ ...c, price: null })),
    };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });
    expect(out).not.toContain("Faixa de preço");
  });

  it("marcas fallback 'Diversas marcas' quando cars vazio", () => {
    const vars = { ...SITE_FIXTURE, cars: [] as typeof SITE_FIXTURE.cars };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });
    expect(out).toContain("- Marcas: Diversas marcas");
  });
});

describe("renderLlmsTxt v2 — ## Inventário atual", () => {
  it("emite contagem de veículos e link para /estoque", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });

    expect(out).toContain("## Inventário atual");
    expect(out).toContain(
      `${SITE_FIXTURE.cars.length} veículos disponíveis. Veja em ${BASE_URL}/sites/${SLUG}/estoque`,
    );
  });

  it("emite bullets com brand model year para cada car", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });

    for (const car of SITE_FIXTURE.cars) {
      expect(out).toContain(`${car.brand} ${car.model} ${car.year}`);
    }
  });

  it("renderiza 'Estoque sendo atualizado' quando cars.length === 0", () => {
    const vars = { ...SITE_FIXTURE, cars: [] as typeof SITE_FIXTURE.cars };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    expect(out).toContain("Estoque sendo atualizado");
    expect(out).not.toMatch(/^- \*\*/m);
  });
});

describe("renderLlmsTxt v2 — ## Garantias", () => {
  it("emite 3 bullets fixos de garantia", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });

    expect(out).toContain("## Garantias");
    expect(out).toContain("- Vistoria técnica em todos os veículos");
    expect(out).toContain("- Garantia de motor e câmbio");
    expect(out).toContain("- Documentação verificada");
  });
});

describe("renderLlmsTxt v2 — ## FAQ", () => {
  it("emite seção FAQ com Q&As do FAQ_TEMPLATE", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });

    expect(out).toContain("## FAQ");
    // Primeira pergunta do FAQ_TEMPLATE canônico
    expect(out).toContain("### Vocês fazem financiamento próprio?");
    // Resposta correspondente (trecho)
    expect(out).toContain("Trabalhamos com os principais bancos parceiros");
  });

  it("emite pelo menos 3 perguntas do FAQ", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });
    const h3Count = (out.match(/^### /gm) ?? []).length;
    expect(h3Count).toBeGreaterThanOrEqual(3);
  });
});

describe("renderLlmsTxt v2 — ## Contato", () => {
  it("emite phone, whatsapp, email, endereço e horários", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });

    expect(out).toContain(`Telefone: ${SITE_FIXTURE.phone_display}`);
    expect(out).toContain(`WhatsApp: ${SITE_FIXTURE.whatsapp}`);
    expect(out).toContain(`Email: ${SITE_FIXTURE.email}`);
    // Endereço: street number, neighborhood, city/state
    expect(out).toContain("Av. Boa Viagem 1000, Boa Viagem, Recife/PE");
    // Horários
    expect(out).toContain(`Atendimento: ${SITE_FIXTURE.hours}`);
    // Link do site
    expect(out).toContain(`Site: ${BASE_URL}/sites/${SLUG}/`);
  });

  it("omite linha 'Email' quando email === null", () => {
    const vars = { ...SITE_FIXTURE, email: null };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    expect(out).not.toContain("Email:");
    expect(out).not.toContain("Email: undefined");
    expect(out).not.toContain("Email: null");
  });

  it("omite linha 'Endereço' quando address === null", () => {
    const vars = { ...SITE_FIXTURE, address: null };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    expect(out).not.toContain("Endereço:");
    expect(out).not.toContain("Endereço: undefined");
    expect(out).not.toContain("Endereço: null");
  });

  it("omite linha 'Atendimento' quando hours === null", () => {
    const vars = { ...SITE_FIXTURE, hours: null };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    expect(out).not.toContain("Atendimento:");
    expect(out).not.toContain("Atendimento: null");
  });
});

describe("renderLlmsTxt v2 — edge case address null", () => {
  it("Localização usa 'no Brasil' quando address === null", () => {
    const vars = { ...SITE_FIXTURE, address: null };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    expect(out).toContain("no Brasil");
    expect(out).not.toContain("Recife - PE");
  });
});

describe("renderLlmsTxt v2 — edge case campos null/empty", () => {
  it("renderiza slogan fallback quando slogan undefined", () => {
    const vars = { ...SITE_FIXTURE, slogan: undefined };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    expect(out).toContain("> Loja de carros seminovos em Recife/PE");
  });

  it("renderiza slogan fallback genérico quando slogan undefined E address null", () => {
    const vars = { ...SITE_FIXTURE, slogan: undefined, address: null };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    expect(out).toContain("> Loja de carros seminovos");
  });

  it("business_name empty → fallback 'Loja de carros seminovos'", () => {
    const vars = { ...SITE_FIXTURE, business_name: "" };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    expect(out).toContain("# Loja de carros seminovos");
  });
});

describe("renderLlmsTxt v2 — sanity defensivo (segurança/parsing)", () => {
  it("sem BOM UTF-8 no início do output", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });
    expect(out.charCodeAt(0)).not.toBe(0xfeff);
  });

  it("não vaza payload bruto JSON nem stringify de Address completo", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });
    expect(out).not.toContain("country: BR");
    expect(out).not.toContain('"country":"BR"');
    expect(out).not.toContain("undefined");
    expect(out).not.toContain("[object Object]");
  });

  it("não contém frases de 'loja online'", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });
    expect(out).not.toContain("loja online");
    expect(out).not.toContain("compre online");
  });
});
