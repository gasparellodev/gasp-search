import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const submitMock = vi.hoisted(() => vi.fn());
const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/app/actions/site-announcement", () => ({
  submitAnnouncement: submitMock,
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

import { AnnounceForm } from "@/components/sites/advertise/AnnounceForm";

const SITE_ID = "66666666-6666-4666-8666-666666666666";
const SLUG = "j7k2p9-touring-cars";

function setup() {
  return render(
    <AnnounceForm
      siteId={SITE_ID}
      slug={SLUG}
      primary_color="#0C0C0C"
      text_on_primary="#FFFFFF"
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("<AnnounceForm />", () => {
  it("renderiza todos os campos esperados (marca, modelo, ano, km, preço, nome, telefone, email, mensagem)", () => {
    setup();
    expect(screen.getByLabelText(/Marca/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Modelo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Ano$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Quilometragem/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Preço pretendido/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Seu nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Telefone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mensagem/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/De acordo com a LGPD/i),
    ).toBeInTheDocument();
  });

  it("bloqueia submit com campos vazios e mostra erros (role=alert)", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(
      screen.getByRole("button", { name: /Enviar anúncio/i }),
    );

    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThan(0);
    });
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("bloqueia submit quando LGPD não marcada", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(screen.getByLabelText(/Marca/i), "Toyota");
    await user.type(screen.getByLabelText(/Modelo/i), "Corolla XEi");
    await user.type(screen.getByLabelText(/^Ano$/i), "2022");
    await user.type(screen.getByLabelText(/Quilometragem/i), "35000");
    await user.type(screen.getByLabelText(/Seu nome/i), "Maria Silva");
    await user.type(
      screen.getByLabelText(/Telefone/i),
      "(11) 98765-4321",
    );
    await user.type(
      screen.getByLabelText(/E-mail/i),
      "maria@example.com",
    );

    await user.click(
      screen.getByRole("button", { name: /Enviar anúncio/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/aceitar a Política de Privacidade/i),
      ).toBeInTheDocument();
    });
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("envia payload válido e mostra toast de sucesso", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ok: true });
    setup();

    await user.type(screen.getByLabelText(/Marca/i), "Toyota");
    await user.type(screen.getByLabelText(/Modelo/i), "Corolla XEi");
    await user.type(screen.getByLabelText(/^Ano$/i), "2022");
    await user.type(screen.getByLabelText(/Quilometragem/i), "35000");
    await user.type(screen.getByLabelText(/Seu nome/i), "Maria Silva");
    await user.type(
      screen.getByLabelText(/Telefone/i),
      "(11) 98765-4321",
    );
    await user.type(
      screen.getByLabelText(/E-mail/i),
      "maria@example.com",
    );
    await user.click(screen.getByLabelText(/De acordo com a LGPD/i));
    await user.click(
      screen.getByRole("button", { name: /Enviar anúncio/i }),
    );

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalledTimes(1);
    });
    const [siteIdArg, payloadArg] = submitMock.mock.calls[0]!;
    expect(siteIdArg).toBe(SITE_ID);
    expect(payloadArg).toMatchObject({
      marca: "Toyota",
      modelo: "Corolla XEi",
      ano: 2022,
      km: 35000,
      nome: "Maria Silva",
      email: "maria@example.com",
      lgpd_consent: true,
    });

    await waitFor(() => {
      expect(toastMocks.success).toHaveBeenCalled();
    });
  });

  it("mostra toast.error quando Server Action retorna { ok: false }", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ok: false, error: "Falha qualquer" });
    setup();

    await user.type(screen.getByLabelText(/Marca/i), "Toyota");
    await user.type(screen.getByLabelText(/Modelo/i), "Corolla");
    await user.type(screen.getByLabelText(/^Ano$/i), "2022");
    await user.type(screen.getByLabelText(/Quilometragem/i), "10000");
    await user.type(screen.getByLabelText(/Seu nome/i), "João");
    await user.type(screen.getByLabelText(/Telefone/i), "11987654321");
    await user.type(
      screen.getByLabelText(/E-mail/i),
      "joao@example.com",
    );
    await user.click(screen.getByLabelText(/De acordo com a LGPD/i));
    await user.click(
      screen.getByRole("button", { name: /Enviar anúncio/i }),
    );

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith("Falha qualquer");
    });
  });
});
