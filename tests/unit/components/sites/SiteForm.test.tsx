import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastMock }));

const submitMock = vi.hoisted(() =>
  vi.fn<
    (
      siteId: string,
      payload: unknown,
    ) => Promise<{ success: true } | { success: false; error: string }>
  >(),
);
vi.mock("@/app/actions/site-form", () => ({
  submitSiteForm: submitMock,
}));

import { SiteForm } from "@/components/sites/SiteForm";

beforeEach(() => {
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  submitMock.mockReset();
  submitMock.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

const baseProps = {
  siteId: "site-1",
  primary_color: "#0C0C0C",
  text_on_primary: "#FFFFFF",
  slug: "abcd1234-touring-cars",
} as const;

describe("<SiteForm />", () => {
  it("renderiza 4 inputs (modelo, nome, email, telefone) + botão Enviar", () => {
    render(<SiteForm {...baseProps} variant="home" />);
    expect(screen.getByPlaceholderText("Modelo")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nome")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("E-mail")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Número")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar/i })).toBeInTheDocument();
  });

  it("variant='car-detail' com prefillModel deixa modelo readOnly e pré-preenchido", () => {
    render(
      <SiteForm
        {...baseProps}
        variant="car-detail"
        prefillModel="Toyota Corolla 2022"
      />,
    );
    const model = screen.getByPlaceholderText("Modelo") as HTMLInputElement;
    expect(model).toHaveValue("Toyota Corolla 2022");
    expect(model).toHaveAttribute("readonly");
    expect(model).toHaveAttribute("aria-readonly", "true");
  });

  it("submit com campos vazios bloqueia e mostra erros inline", async () => {
    const user = userEvent.setup();
    render(<SiteForm {...baseProps} variant="home" />);
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    await waitFor(() => {
      expect(submitMock).not.toHaveBeenCalled();
    });
    // Pelo menos uma mensagem de erro deve aparecer (campos obrigatórios).
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
  });

  it("submit com email inválido bloqueia", async () => {
    const user = userEvent.setup();
    render(<SiteForm {...baseProps} variant="home" />);
    await user.type(screen.getByPlaceholderText("Modelo"), "Toyota");
    await user.type(screen.getByPlaceholderText("Nome"), "Maria");
    await user.type(screen.getByPlaceholderText("E-mail"), "naoeumemail");
    await user.type(screen.getByPlaceholderText("Número"), "11987654321");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    await waitFor(() => {
      expect(submitMock).not.toHaveBeenCalled();
    });
    const alerts = await screen.findAllByRole("alert");
    expect(
      alerts.some((el) => /email/i.test(el.textContent ?? "")),
    ).toBe(true);
  });

  it("submit com LGPD desmarcado bloqueia e exibe erro", async () => {
    const user = userEvent.setup();
    render(<SiteForm {...baseProps} variant="home" />);
    await user.type(screen.getByPlaceholderText("Modelo"), "Toyota");
    await user.type(screen.getByPlaceholderText("Nome"), "Maria");
    await user.type(screen.getByPlaceholderText("E-mail"), "m@x.com");
    await user.type(screen.getByPlaceholderText("Número"), "11987654321");
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    await waitFor(() => {
      expect(submitMock).not.toHaveBeenCalled();
    });
  });

  it("submit válido chama submitSiteForm e dispara toast de sucesso", async () => {
    const user = userEvent.setup();
    render(<SiteForm {...baseProps} variant="home" />);
    await user.type(screen.getByPlaceholderText("Modelo"), "Toyota Corolla");
    await user.type(screen.getByPlaceholderText("Nome"), "Maria Silva");
    await user.type(
      screen.getByPlaceholderText("E-mail"),
      "maria@example.com",
    );
    await user.type(
      screen.getByPlaceholderText("Número"),
      "11987654321",
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    await waitFor(() => {
      expect(submitMock).toHaveBeenCalledTimes(1);
    });
    expect(submitMock).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        model: "Toyota Corolla",
        name: "Maria Silva",
        email: "maria@example.com",
        phone: "11987654321",
        lgpd: true,
      }),
    );
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith(
        expect.stringMatching(/enviada/i),
      );
    });
  });

  it("toast de erro quando submitSiteForm retorna { success:false }", async () => {
    submitMock.mockResolvedValueOnce({
      success: false,
      error: "Servidor offline",
    });
    const user = userEvent.setup();
    render(<SiteForm {...baseProps} variant="home" />);
    await user.type(screen.getByPlaceholderText("Modelo"), "Toyota");
    await user.type(screen.getByPlaceholderText("Nome"), "Maria");
    await user.type(screen.getByPlaceholderText("E-mail"), "m@x.com");
    await user.type(screen.getByPlaceholderText("Número"), "11987654321");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith("Servidor offline");
    });
  });

  it("Política de Privacidade é Link com href apontando para /sites/<slug>/lgpd", () => {
    render(<SiteForm {...baseProps} variant="home" />);
    const link = screen.getByRole("link", { name: /política de privacidade/i });
    expect(link).toHaveAttribute(
      "href",
      `/sites/${baseProps.slug}/lgpd`,
    );
  });

  it("toast de erro quando Server Action lança (catch branch)", async () => {
    submitMock.mockRejectedValueOnce(new Error("rede"));
    const user = userEvent.setup();
    render(<SiteForm {...baseProps} variant="home" />);
    await user.type(screen.getByPlaceholderText("Modelo"), "Toyota");
    await user.type(screen.getByPlaceholderText("Nome"), "Maria");
    await user.type(screen.getByPlaceholderText("E-mail"), "m@x.com");
    await user.type(screen.getByPlaceholderText("Número"), "11987654321");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        expect.stringMatching(/erro ao enviar/i),
      );
    });
  });

  it("usa fallback de cor no botão quando primary_color é inválido (proteção XSS)", () => {
    render(
      <SiteForm
        {...baseProps}
        primary_color="javascript:alert(1)"
        variant="home"
      />,
    );
    const btn = screen.getByRole("button", { name: /enviar/i });
    expect(btn).toHaveStyle({ backgroundColor: "#0C0C0C" });
  });
});
