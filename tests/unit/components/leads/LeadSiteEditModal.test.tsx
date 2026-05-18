/**
 * Testes do `<LeadSiteEditModal />` (issue #168) — modal de edição
 * manual de `SiteVariables`.
 *
 * Cobre AC1 (estrutura), AC2 (campos editáveis + cars[]), AC4 (submit
 * success path com dirty fields), AC5 (error paths) e AC8 (a11y básica).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LeadSiteEditModal } from "@/components/leads/LeadSiteEditModal";
import type { LeadSiteCardData } from "@/components/leads/lead-site-card-types";
import type { SiteVariablesV2 } from "@/types/lead-site";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => ({
  updateLeadSiteVariables: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastMessage: vi.fn(),
}));

vi.mock("@/app/actions/lead-site", () => ({
  updateLeadSiteVariables: hoisted.updateLeadSiteVariables,
}));

vi.mock("sonner", () => ({
  toast: {
    success: hoisted.toastSuccess,
    error: hoisted.toastError,
    message: hoisted.toastMessage,
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeVariables(): SiteVariablesV2 {
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

    // Visual (nested v2)
    brand_assets: {
      logo_url: "https://example.com/logo.png",
      primary_color: "#0c5cff",
      text_on_primary: "#FFFFFF",
      hero_image_url: "https://example.com/hero.jpg",
      about_image_url: "https://example.com/about.jpg",
      contact_image_url: "https://example.com/contact.jpg",
      car_placeholders: [],
    },

    // Conteúdo de página
    home_categories: [
      { label: "0km", image_url: "https://example.com/cat1.jpg" },
      { label: "Seminovos", image_url: "https://example.com/cat2.jpg" },
      { label: "Promoção", image_url: "https://example.com/cat3.jpg" },
    ],
    emphasis: {
      title: "Destaque do mês",
      car_name: "Modelo X Destaque",
      description:
        "Modelo recém-chegado, revisado e pronto pra rodar. Documentação em dia, garantia estendida e financiamento facilitado.",
      image_url: "https://example.com/car1.jpg",
    },
    recent_sales: [
      { car_name: "Recente 1", image_url: "https://example.com/r1.jpg" },
      { car_name: "Recente 2", image_url: "https://example.com/r2.jpg" },
      { car_name: "Recente 3", image_url: "https://example.com/r3.jpg" },
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
        "Sedan compacto 1.6 com manutenção em dia, único dono. Documentação em ordem e revisão recém-feita na concessionária.",
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
    schema_version: 2,
    generated_by: "claude-sonnet-4-6",
    generation_version: "v2.0.0",
  };
}

function makeLeadSite(
  overrides: Partial<LeadSiteCardData> = {},
): LeadSiteCardData {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    slug: "j7k2p9-toyota-recife",
    status: "published",
    generated_at: "2026-05-09T12:00:00.000Z",
    published_at: "2026-05-09T12:00:00.000Z",
    sent_at: null,
    view_count: 0,
    variables: makeVariables(),
    generation_error: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// AC1 — estrutura do modal
// ---------------------------------------------------------------------------

describe("LeadSiteEditModal — AC1 estrutura", () => {
  it("renderiza dialog com title, description e form quando open=true", () => {
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /editar site/i, level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: /editar variáveis do site/i }),
    ).toBeInTheDocument();
  });

  it("não renderiza conteúdo quando open=false", () => {
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open={false}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("preenche default values a partir de leadSite.variables", () => {
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    expect(
      screen.getByLabelText("Nome do negócio") as HTMLInputElement,
    ).toHaveValue("Toyota Recife");
    expect(
      screen.getByLabelText("Slogan") as HTMLInputElement,
    ).toHaveValue("Sua próxima conquista nas quatro rodas");
    expect(
      screen.getByLabelText("WhatsApp") as HTMLInputElement,
    ).toHaveValue("5581999999999");
  });
});

// ---------------------------------------------------------------------------
// AC2 — cars[] field array
// ---------------------------------------------------------------------------

describe("LeadSiteEditModal — AC2 cars[]", () => {
  it("renderiza um item por carro com botão Remover", () => {
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByTestId("lead-site-edit-car-0")).toBeInTheDocument();
    expect(screen.getByTestId("lead-site-edit-car-3")).toBeInTheDocument();
  });

  it("permite adicionar um carro novo até 6", async () => {
    const user = userEvent.setup();
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getAllByTestId(/lead-site-edit-car-\d+$/).length).toBe(4);
    await user.click(screen.getByTestId("lead-site-edit-add-car"));
    expect(screen.getAllByTestId(/lead-site-edit-car-\d+$/).length).toBe(5);
  });

  it("desabilita botões Remover quando o array tem o mínimo (4)", () => {
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    const removeButtons = screen.getAllByTestId(
      /lead-site-edit-remove-car-\d+/,
    );
    removeButtons.forEach((btn) => expect(btn).toBeDisabled());
  });
});

// ---------------------------------------------------------------------------
// AC4 — submit success path
// ---------------------------------------------------------------------------

describe("LeadSiteEditModal — AC4 submit success", () => {
  it("submit sem alterações não chama Server Action e fecha o modal", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={onOpenChange}
      />,
    );
    await user.click(screen.getByTestId("lead-site-edit-submit"));
    await waitFor(() => {
      expect(hoisted.updateLeadSiteVariables).not.toHaveBeenCalled();
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(hoisted.toastMessage).toHaveBeenCalledWith(
      expect.stringMatching(/nenhuma alteração/i),
    );
  });

  it("envia apenas dirty fields no patch e mostra toast success", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    hoisted.updateLeadSiteVariables.mockResolvedValue({
      ok: true,
      slug: "j7k2p9-toyota-recife",
    });

    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={onOpenChange}
      />,
    );
    const slogan = screen.getByLabelText("Slogan") as HTMLInputElement;
    await user.clear(slogan);
    await user.type(
      slogan,
      "Slogan novo e diferente do anterior em 2026 hoje",
    );

    await user.click(screen.getByTestId("lead-site-edit-submit"));

    await waitFor(() => {
      expect(hoisted.updateLeadSiteVariables).toHaveBeenCalledTimes(1);
    });
    const [, patch] = hoisted.updateLeadSiteVariables.mock.calls[0]!;
    // Patch deve conter SOMENTE slogan (único campo tocado)
    expect(Object.keys(patch as object)).toEqual(["slogan"]);
    expect((patch as { slogan: string }).slogan).toMatch(/slogan novo/i);
    expect(hoisted.toastSuccess).toHaveBeenCalledWith(
      "Site atualizado!",
      expect.objectContaining({ description: expect.any(String) }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// ---------------------------------------------------------------------------
// AC5 — submit error paths
// ---------------------------------------------------------------------------

describe("LeadSiteEditModal — AC5 error paths", () => {
  it("toast error com mensagem PT-BR para each error code", async () => {
    const user = userEvent.setup();
    hoisted.updateLeadSiteVariables.mockResolvedValue({
      ok: false,
      error: "invalid_status",
      message: "qualquer",
    });

    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    const slogan = screen.getByLabelText("Slogan") as HTMLInputElement;
    await user.clear(slogan);
    await user.type(slogan, "Outro slogan diferente válido aqui agora");
    await user.click(screen.getByTestId("lead-site-edit-submit"));

    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalledWith(
        expect.stringMatching(/não foi possível salvar/i),
        expect.objectContaining({
          description: expect.stringMatching(/publicados ou enviados/i),
        }),
      );
    });
  });

  it("toast error em throw inesperado da Server Action", async () => {
    const user = userEvent.setup();
    hoisted.updateLeadSiteVariables.mockRejectedValue(new Error("boom"));
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    const slogan = screen.getByLabelText("Slogan") as HTMLInputElement;
    await user.clear(slogan);
    await user.type(slogan, "Slogan x novo distinto bem maior aqui");
    await user.click(screen.getByTestId("lead-site-edit-submit"));

    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalledWith(
        expect.stringMatching(/não foi possível salvar/i),
        expect.objectContaining({
          description: expect.stringMatching(/erro inesperado/i),
        }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// AC8 — acessibilidade básica
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AC5 — error mapping para todos os códigos
// ---------------------------------------------------------------------------

describe.each([
  ["auth", /sessão expirada/i],
  ["not_found", /site não encontrado/i],
  ["validation", /não passaram na validação/i],
  ["db_error", /erro ao salvar/i],
])("LeadSiteEditModal — toast error mapping (%s)", (code, expectedRegex) => {
  it(`mapeia código '${code}' pra mensagem PT-BR`, async () => {
    const user = userEvent.setup();
    hoisted.updateLeadSiteVariables.mockResolvedValue({
      ok: false,
      error: code,
      message: "raw",
    });
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    const slogan = screen.getByLabelText("Slogan") as HTMLInputElement;
    await user.clear(slogan);
    await user.type(slogan, "Slogan novo válido aqui em 2026 hoje");
    await user.click(screen.getByTestId("lead-site-edit-submit"));

    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          description: expect.stringMatching(expectedRegex),
        }),
      );
    });
  });
});

describe("LeadSiteEditModal — error mapping fallback", () => {
  it("código desconhecido cai no default e usa result.message", async () => {
    const user = userEvent.setup();
    hoisted.updateLeadSiteVariables.mockResolvedValue({
      ok: false,
      error: "totally_unknown_code",
      message: "Mensagem custom do server",
    });
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    const slogan = screen.getByLabelText("Slogan") as HTMLInputElement;
    await user.clear(slogan);
    await user.type(slogan, "Slogan completamente diferente do anterior");
    await user.click(screen.getByTestId("lead-site-edit-submit"));

    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          description: "Mensagem custom do server",
        }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// AC2 — comportamento do botão Adicionar
// ---------------------------------------------------------------------------

describe("LeadSiteEditModal — add car edge cases", () => {
  it("botão Adicionar fica desabilitado ao atingir 6 carros", async () => {
    const user = userEvent.setup();
    const variables = makeVariables();
    // Estende pra 6 carros
    const sixCars = [
      ...variables.cars,
      { ...variables.cars[0]!, slug: "car-5" },
      { ...variables.cars[0]!, slug: "car-6" },
    ];
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite({
          variables: { ...variables, cars: sixCars },
        })}
        open
        onOpenChange={() => {}}
      />,
    );
    const addBtn = screen.getByTestId("lead-site-edit-add-car");
    expect(addBtn).toBeDisabled();
    // Tenta clicar mesmo assim — não deve adicionar
    await user.click(addBtn).catch(() => {});
    expect(screen.getAllByTestId(/lead-site-edit-car-\d+$/).length).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// #197 PR-C — v2 shape (address nested, brand_assets nested, cars v2 fields)
// ---------------------------------------------------------------------------

describe("LeadSiteEditModal — #197 PR-C v2 shape", () => {
  it("submit edita brand_assets.primary_color e envia objeto brand_assets inteiro", async () => {
    const user = userEvent.setup();
    hoisted.updateLeadSiteVariables.mockResolvedValue({
      ok: true,
      slug: "j7k2p9-toyota-recife",
    });
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    const primary = screen.getByLabelText("Cor primária") as HTMLInputElement;
    await user.clear(primary);
    await user.type(primary, "#abcdef");

    await user.click(screen.getByTestId("lead-site-edit-submit"));
    await waitFor(() => {
      expect(hoisted.updateLeadSiteVariables).toHaveBeenCalledTimes(1);
    });
    const [, patch] = hoisted.updateLeadSiteVariables.mock.calls[0]!;
    const patchObj = patch as { brand_assets?: { primary_color: string } };
    // Server Action faz shallow merge top-level — patch envia brand_assets inteiro.
    expect(patchObj.brand_assets).toBeDefined();
    expect(patchObj.brand_assets!.primary_color).toBe("#abcdef");
  });

  it("address default null com checkbox 'indisponível' marcado", () => {
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    // makeVariables() retorna address: null → checkbox deve estar marcado.
    const checkbox = screen.getByTestId(
      "lead-site-edit-address-disabled",
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("desmarcar 'indisponível' renderiza 6 campos de endereço", async () => {
    const user = userEvent.setup();
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    const checkbox = screen.getByTestId(
      "lead-site-edit-address-disabled",
    ) as HTMLInputElement;
    await user.click(checkbox);
    expect(screen.getByLabelText("Rua")).toBeInTheDocument();
    expect(screen.getByLabelText("Número")).toBeInTheDocument();
    expect(screen.getByLabelText("Bairro")).toBeInTheDocument();
    expect(screen.getByLabelText("Cidade")).toBeInTheDocument();
    expect(screen.getByLabelText("UF")).toBeInTheDocument();
    expect(screen.getByLabelText("CEP")).toBeInTheDocument();
  });

  it("cars[].category select tem 6 opções do enum v2", () => {
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    // Carro 0 (índice 0) → "Categoria" → 6 opções.
    const categorySelects = screen.getAllByLabelText("Categoria");
    expect(categorySelects.length).toBeGreaterThanOrEqual(4);
    const firstSelect = categorySelects[0] as HTMLSelectElement;
    const options = Array.from(firstSelect.options).map((o) => o.value);
    expect(options).toEqual([
      "SUV",
      "Sedan",
      "Hatch",
      "Pickup",
      "Esportivo",
      "Conversível",
    ]);
  });

  it("cars[].doors select tem opção 'não informar' + 2/3/4/5", () => {
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    const doorsSelects = screen.getAllByLabelText("Portas");
    expect(doorsSelects.length).toBeGreaterThanOrEqual(4);
    const firstSelect = doorsSelects[0] as HTMLSelectElement;
    const options = Array.from(firstSelect.options).map((o) => o.value);
    expect(options).toEqual(["", "2", "3", "4", "5"]);
  });

  it("cars[].plates_visible NÃO aparece como campo editável (compliance — hidden + readonly)", () => {
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    // Hidden inputs presentes (1 por carro).
    const hiddens = screen.getAllByTestId(/lead-site-edit-car-\d+-plates-hidden/);
    expect(hiddens.length).toBeGreaterThanOrEqual(4);
    for (const h of hiddens) {
      const input = h as HTMLInputElement;
      expect(input.type).toBe("hidden");
      expect(input.value).toBe("false");
      expect(input.readOnly).toBe(true);
    }
  });

  it("VIN inválido (não-17-chars) bloqueia submit com erro de validação", async () => {
    const user = userEvent.setup();
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    const vinInputs = screen.getAllByLabelText("VIN/Chassi");
    const firstVin = vinInputs[0] as HTMLInputElement;
    await user.clear(firstVin);
    await user.type(firstVin, "123"); // 3 chars — não passa regex 17.

    await user.click(screen.getByTestId("lead-site-edit-submit"));
    await waitFor(() => {
      expect(firstVin).toHaveAttribute("aria-invalid", "true");
    });
    expect(hoisted.updateLeadSiteVariables).not.toHaveBeenCalled();
  });

  it("VIN vazio é tratado como undefined (optional) — submit flui", async () => {
    const user = userEvent.setup();
    hoisted.updateLeadSiteVariables.mockResolvedValue({
      ok: true,
      slug: "j7k2p9-toyota-recife",
    });
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    // VIN inputs estão vazios por default em makeVariables (não tem vin).
    // Vamos editar slogan pra disparar isDirty.
    const slogan = screen.getByLabelText("Slogan") as HTMLInputElement;
    await user.clear(slogan);
    await user.type(slogan, "Outro slogan que dispara dirty fields aqui");

    await user.click(screen.getByTestId("lead-site-edit-submit"));
    await waitFor(() => {
      expect(hoisted.updateLeadSiteVariables).toHaveBeenCalledTimes(1);
    });
  });
});

describe("LeadSiteEditModal — AC8 a11y", () => {
  it("inputs têm aria-invalid quando há erro de validação", async () => {
    const user = userEvent.setup();
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={() => {}}
      />,
    );
    const primary = screen.getByLabelText(
      "Cor primária",
    ) as HTMLInputElement;
    await user.clear(primary);
    await user.type(primary, "not-a-hex");
    await user.click(screen.getByTestId("lead-site-edit-submit"));

    await waitFor(() => {
      expect(primary).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("botão cancelar dispara onOpenChange(false)", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={onOpenChange}
      />,
    );
    await user.click(screen.getByTestId("lead-site-edit-cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// ---------------------------------------------------------------------------
// Sprint C2 — Image preview grid + adição rápida de URL
// ---------------------------------------------------------------------------

describe("LeadSiteEditModal — Sprint C2 image preview + quick-add", () => {
  it("renderiza ImagePreviewGrid para cada carro com as fotos default", () => {
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={vi.fn()}
      />,
    );

    // Fixture makeVariables() cria 4 carros com 3 fotos cada
    // (`g1-1.jpg`, `g1-2.jpg`, `g1-3.jpg`).
    for (let carIdx = 0; carIdx < 4; carIdx++) {
      const grid = screen.getByTestId(
        `lead-site-edit-car-${carIdx}-photos-grid`,
      );
      expect(grid).toBeInTheDocument();
      expect(grid.children).toHaveLength(3);
    }
  });

  it("clicar no botão X da grid remove a foto da textarea", async () => {
    const user = userEvent.setup();
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={vi.fn()}
      />,
    );

    const textarea = screen.getByTestId(
      "lead-site-edit-car-0-photos",
    ) as HTMLTextAreaElement;
    expect(textarea.value).toContain("g1-1.jpg");

    // Remove a primeira foto via grid (botão X dentro do thumb 0)
    // do carro 0 — usa testid pra evitar colisão com os botões
    // "Remover foto 1" dos outros 3 carros do fixture.
    const grid = screen.getByTestId(
      "lead-site-edit-car-0-photos-grid",
    );
    const removeBtn = grid.querySelector<HTMLButtonElement>(
      '[data-testid="image-preview-grid-remove-0"]',
    );
    expect(removeBtn).not.toBeNull();
    await user.click(removeBtn!);

    expect(textarea.value).not.toContain("g1-1.jpg");
    expect(textarea.value).toContain("g1-2.jpg");
    expect(textarea.value).toContain("g1-3.jpg");
  });

  it("quick-add: digitar URL válida + Enter adiciona à textarea e limpa input", async () => {
    const user = userEvent.setup();
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={vi.fn()}
      />,
    );

    const input = screen.getByTestId(
      "lead-site-edit-car-0-photos-quick-add-input",
    ) as HTMLInputElement;
    const button = screen.getByTestId(
      "lead-site-edit-car-0-photos-quick-add-btn",
    );
    const textarea = screen.getByTestId(
      "lead-site-edit-car-0-photos",
    ) as HTMLTextAreaElement;

    await user.type(input, "https://nova.com/foto-extra.jpg");
    await user.click(button);

    expect(textarea.value).toContain("https://nova.com/foto-extra.jpg");
    expect(input.value).toBe("");
  });

  it("quick-add: URL inválida mostra erro inline e NÃO adiciona", async () => {
    const user = userEvent.setup();
    render(
      <LeadSiteEditModal
        leadSite={makeLeadSite()}
        open
        onOpenChange={vi.fn()}
      />,
    );

    const input = screen.getByTestId(
      "lead-site-edit-car-0-photos-quick-add-input",
    ) as HTMLInputElement;
    const button = screen.getByTestId(
      "lead-site-edit-car-0-photos-quick-add-btn",
    );
    const textarea = screen.getByTestId(
      "lead-site-edit-car-0-photos",
    ) as HTMLTextAreaElement;
    const initial = textarea.value;

    await user.type(input, "nao-eh-url");
    await user.click(button);

    expect(textarea.value).toBe(initial);
    expect(
      screen.getByTestId("lead-site-edit-car-0-photos-quick-add-error"),
    ).toBeInTheDocument();
  });
});
