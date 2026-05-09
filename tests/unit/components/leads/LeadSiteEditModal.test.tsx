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
import type { SiteVariables } from "@/types/lead-site";

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

function makeVariables(): SiteVariables {
  return {
    business_name: "Toyota Recife",
    business_slug: "toyota-recife",
    slogan: "Sua próxima conquista nas quatro rodas",
    primary_color: "#0c5cff",
    text_on_primary: "#FFFFFF",
    logo_url: "https://example.com/logo.png",
    whatsapp: "5581999999999",
    phone_display: "(81) 99999-9999",
    email: "contato@example.com",
    instagram_url: "https://instagram.com/example",
    facebook_url: null,
    youtube_url: null,
    address_line: "Recife, PE",
    hours: null,
    hero_image_url: "https://example.com/hero.jpg",
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
    about_text:
      "Somos uma concessionária familiar com paixão por carros. Cada cliente é tratado como parte da nossa história. Da escolha do modelo à assinatura do contrato, queremos que você se sinta em casa. Trabalhamos com financeiras parceiras pra que o sonho do carro novo caiba no seu bolso.",
    about_image_url: "https://example.com/about.jpg",
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
    contact_hero_image_url: "https://example.com/contact.jpg",
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
      datasheet: [["Câmbio", "Automático"]] as Array<[string, string]>,
      featured: i === 0,
    })),
    generated_by: "claude-sonnet-4-6" as const,
    generation_version: "v1.0.0",
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
