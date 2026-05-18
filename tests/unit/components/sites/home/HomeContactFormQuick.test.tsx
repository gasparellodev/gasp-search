/**
 * Tests do <HomeContactFormQuick /> (issue #223 / Sprint 4 / H3).
 *
 * Lead capture principal — bg-foreground/text-background, 4 inputs +
 * message + honeypot + min-time gate + LGPD. Gated por
 * `NEXT_PUBLIC_SITE_FORMS_ENABLED === '1'`.
 *
 * Uso `vi.mock` inline pra controlar a flag + a server action.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

expect.extend(toHaveNoViolations);

const { submitMock, flagState, toastMock } = vi.hoisted(() => ({
  submitMock: vi.fn(),
  flagState: { value: "1" },
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/app/actions/site-form", () => ({
  submitSiteForm: submitMock,
}));

vi.mock("@/lib/env-public", () => ({
  publicEnv: {
    get NEXT_PUBLIC_APP_URL() {
      return "http://localhost:3000";
    },
    get NEXT_PUBLIC_SUPABASE_URL() {
      return "http://localhost:54321";
    },
    get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
      return "anon";
    },
    get NEXT_PUBLIC_WHATSAPP_ENABLED() {
      return "0";
    },
    get NEXT_PUBLIC_SITE_FORMS_ENABLED() {
      return flagState.value;
    },
  },
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

import { HomeContactFormQuick } from "@/components/sites/home/HomeContactFormQuick";

const baseProps = {
  siteId: "site-uuid-123",
  businessName: "Poliguara",
  slug: "abc-poliguara",
};

beforeEach(() => {
  flagState.value = "1";
  submitMock.mockReset();
  submitMock.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("<HomeContactFormQuick /> — feature flag gate", () => {
  it("retorna null quando flag está OFF", () => {
    flagState.value = "0";
    const { container } = render(<HomeContactFormQuick {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza form quando flag está ON", () => {
    flagState.value = "1";
    render(<HomeContactFormQuick {...baseProps} />);
    expect(
      screen.getByRole("region", { name: /formul[áa]rio de contato r/i }),
    ).toBeInTheDocument();
  });
});

describe("<HomeContactFormQuick /> — visual + estrutura", () => {
  it("renderiza h2 'Fale com a nossa equipe'", () => {
    render(<HomeContactFormQuick {...baseProps} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /fale com a nossa equipe/i }),
    ).toBeInTheDocument();
  });

  it("renderiza 4 inputs visíveis (name, phone, email) + textarea (message)", () => {
    render(<HomeContactFormQuick {...baseProps} />);
    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/telefone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^mensagem$/i)).toBeInTheDocument();
  });

  it("renderiza LGPD checkbox com texto canônico + link", () => {
    render(<HomeContactFormQuick {...baseProps} />);
    const cb = screen.getByRole("checkbox");
    expect(cb).toBeInTheDocument();
    expect(
      screen.getByText(/Concordo com a Política de Privacidade de/i),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /ler política/i });
    expect(link.getAttribute("href")).toBe("/sites/abc-poliguara/lgpd");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("variant default é 'dark' com bg-foreground/text-background", () => {
    render(<HomeContactFormQuick {...baseProps} />);
    const section = screen.getByTestId("home-contact-form-quick");
    expect(section.getAttribute("data-variant")).toBe("dark");
    expect(section.className).toContain("bg-foreground");
    expect(section.className).toContain("text-background");
  });

  it("variant='light' aplica bg-background/text-foreground (fix /sobre)", () => {
    render(<HomeContactFormQuick {...baseProps} variant="light" />);
    const section = screen.getByTestId("home-contact-form-quick");
    expect(section.getAttribute("data-variant")).toBe("light");
    expect(section.className).toContain("bg-background");
    expect(section.className).toContain("text-foreground");
    expect(section.className).not.toContain("bg-foreground");
  });
});

describe("<HomeContactFormQuick /> — honeypot anti-bot", () => {
  it("renderiza honeypot field <input name='website'> com tabIndex -1 e aria-hidden", () => {
    render(<HomeContactFormQuick {...baseProps} />);
    const honeypot = document.querySelector(
      'input[name="website"]',
    ) as HTMLInputElement | null;
    expect(honeypot).not.toBeNull();
    expect(honeypot?.getAttribute("tabindex")).toBe("-1");
    expect(honeypot?.getAttribute("autocomplete")).toBe("off");
  });

  it("honeypot ancestor tem aria-hidden e está fora da viewport (left: -9999px)", () => {
    render(<HomeContactFormQuick {...baseProps} />);
    const honeypot = document.querySelector(
      'input[name="website"]',
    ) as HTMLInputElement | null;
    const wrapper = honeypot?.closest('[aria-hidden="true"]');
    expect(wrapper).not.toBeNull();
    expect((wrapper as HTMLElement).style.left).toBe("-9999px");
  });
});

describe("<HomeContactFormQuick /> — submit flow", () => {
  it("submit válido chama submitSiteForm com payload + extras (renderedAt + honeypot)", async () => {
    const user = userEvent.setup();
    render(<HomeContactFormQuick {...baseProps} />);

    await user.type(screen.getByLabelText(/nome completo/i), "Maria Silva");
    await user.type(screen.getByLabelText(/telefone/i), "11987654321");
    await user.type(screen.getByLabelText(/e-mail/i), "maria@example.com");
    await user.type(
      screen.getByLabelText(/^mensagem$/i),
      "Tenho interesse no Toyota Corolla 2020.",
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /enviar mensagem/i }));

    expect(submitMock).toHaveBeenCalledTimes(1);
    const [siteId, values, extras] = submitMock.mock.calls[0] ?? [];
    expect(siteId).toBe("site-uuid-123");
    expect(values).toMatchObject({
      name: "Maria Silva",
      phone: "11987654321",
      email: "maria@example.com",
      message: "Tenho interesse no Toyota Corolla 2020.",
      lgpd: true,
    });
    expect(extras).toHaveProperty("honeypot");
    expect(extras).toHaveProperty("renderedAt");
    expect(typeof extras.renderedAt).toBe("number");
  });

  it("dispara toast de erro quando submitSiteForm retorna success:false", async () => {
    submitMock.mockResolvedValueOnce({
      success: false,
      error: "Muitas tentativas. Tente novamente em 1 hora.",
    });
    const user = userEvent.setup();
    render(<HomeContactFormQuick {...baseProps} />);

    await user.type(screen.getByLabelText(/nome completo/i), "Maria Silva");
    await user.type(screen.getByLabelText(/telefone/i), "11987654321");
    await user.type(screen.getByLabelText(/e-mail/i), "maria@example.com");
    await user.type(
      screen.getByLabelText(/^mensagem$/i),
      "Mensagem suficiente.",
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /enviar mensagem/i }));

    expect(toastMock.error).toHaveBeenCalledWith(
      "Muitas tentativas. Tente novamente em 1 hora.",
    );
  });

  it("não chama submitSiteForm quando LGPD não marcado (Zod rejeita)", async () => {
    const user = userEvent.setup();
    render(<HomeContactFormQuick {...baseProps} />);

    await user.type(screen.getByLabelText(/nome completo/i), "Maria Silva");
    await user.type(screen.getByLabelText(/telefone/i), "11987654321");
    await user.type(screen.getByLabelText(/e-mail/i), "maria@example.com");
    await user.type(
      screen.getByLabelText(/^mensagem$/i),
      "Mensagem suficiente.",
    );
    // SEM clicar no checkbox de LGPD
    await user.click(screen.getByRole("button", { name: /enviar mensagem/i }));

    expect(submitMock).not.toHaveBeenCalled();
  });
});

describe("<HomeContactFormQuick /> — a11y", () => {
  it("zero violations a11y (axe-core)", async () => {
    const { container } = render(<HomeContactFormQuick {...baseProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
