import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const submitMock = vi.hoisted(() => vi.fn());
const uploadUrlMock = vi.hoisted(() => vi.fn());
const compressionMock = vi.hoisted(() => vi.fn(async (file: File) => file));
const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/app/actions/site-announcement", () => ({
  submitAnnouncement: submitMock,
  requestUploadUrl: uploadUrlMock,
}));

vi.mock("browser-image-compression", () => ({
  default: compressionMock,
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
      targetCarSlug="bmw-m2-2023"
      formSignature="signed-context"
    />,
  );
}

async function fillCarStep(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByLabelText(/Marca/i), {
    target: { value: "Toyota" },
  });
  fireEvent.change(screen.getByLabelText(/Modelo/i), {
    target: { value: "Corolla XEi" },
  });
  fireEvent.change(screen.getByLabelText(/^Ano$/i), {
    target: { value: "2022" },
  });
  fireEvent.change(screen.getByLabelText(/Quilometragem/i), {
    target: { value: "35000" },
  });
  await user.click(screen.getByRole("button", { name: /Continuar/i }));
}

async function fillOwnerStep(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByLabelText(/Seu nome/i), {
    target: { value: "Maria Silva" },
  });
  fireEvent.change(screen.getByLabelText(/Telefone/i), {
    target: { value: "(11) 98765-4321" },
  });
  fireEvent.change(screen.getByLabelText(/E-mail/i), {
    target: { value: "maria@example.com" },
  });
  await user.click(screen.getByRole("button", { name: /Continuar/i }));
}

function makeJpegFile(name: string) {
  return new File(
    [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1])],
    name,
    { type: "image/jpeg" },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  submitMock.mockResolvedValue({
    ok: true,
    leadId: "lead-1",
    uploadToken: "upload-token",
  });
  uploadUrlMock.mockResolvedValue({
    ok: true,
    path: "lead-1/0-1.jpg",
    signedUrl: "https://storage.example/upload",
  });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })));
});

describe("<AnnounceForm />", () => {
  it("renderiza stepper com 4 passos e honeypot", () => {
    setup();
    expect(screen.getByTestId("announce-stepper")).toHaveTextContent("Carro");
    expect(screen.getByTestId("announce-stepper")).toHaveTextContent("Proprietário");
    expect(screen.getByTestId("announce-stepper")).toHaveTextContent("Fotos");
    expect(screen.getByTestId("announce-stepper")).toHaveTextContent("Revisão+LGPD");
    expect(
      document.querySelector("input[name='_hp_company']"),
    ).toBeInTheDocument();
  });

  it("bloqueia avanço no primeiro passo com campos vazios", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    });
    expect(screen.getByRole("heading", { name: "Carro" })).toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("bloqueia Step Fotos quando há menos de 2 fotos", async () => {
    const user = userEvent.setup();
    setup();

    await fillCarStep(user);
    await fillOwnerStep(user);
    expect(screen.getByText(/Borre a placa antes de enviar/i)).toBeInTheDocument();

    await user.upload(screen.getByLabelText(/Fotos do veículo/i), [
      makeJpegFile("frente.jpg"),
    ]);
    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    expect(
      await screen.findByText("Adicione pelo menos 2 fotos do veículo para continuar."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fotos" })).toBeInTheDocument();
  });

  it("envia payload válido, comprime e sobe 2 fotos", async () => {
    const user = userEvent.setup();
    setup();

    await fillCarStep(user);
    await fillOwnerStep(user);
    await user.upload(screen.getByLabelText(/Fotos do veículo/i), [
      makeJpegFile("frente.jpg"),
      makeJpegFile("painel.jpg"),
    ]);
    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    expect(
      screen.getByText(/Concordo com o tratamento dos meus dados pessoais/i),
    ).toBeInTheDocument();
    await user.click(
      screen.getByLabelText(/Concordo com o tratamento dos meus dados pessoais/i),
    );
    await user.click(screen.getByRole("button", { name: /Enviar anúncio/i }));

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalledTimes(1);
    });
    expect(submitMock).toHaveBeenCalledWith(
      SITE_ID,
      expect.objectContaining({
        marca: "Toyota",
        modelo: "Corolla XEi",
        ano: 2022,
        km: 35000,
        email: "maria@example.com",
        car_target_slug: "bmw-m2-2023",
        lgpd_consent: true,
      }),
      { honeypot: "", formSignature: "signed-context" },
    );

    await waitFor(() => {
      expect(uploadUrlMock).toHaveBeenCalledTimes(2);
    });
    expect(compressionMock).toHaveBeenCalledTimes(2);
    expect(uploadUrlMock).toHaveBeenCalledWith(
      SITE_ID,
      expect.objectContaining({
        leadId: "lead-1",
        uploadToken: "upload-token",
        ext: "jpg",
        mimeType: "image/jpeg",
        magicHeader: "ffd8ffe000104a4649460001",
      }),
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(toastMocks.success).toHaveBeenCalled();
  });

  it("mostra toast.error quando Server Action retorna { ok: false }", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ok: false, error: "Falha qualquer" });
    setup();

    await fillCarStep(user);
    await fillOwnerStep(user);
    await user.upload(screen.getByLabelText(/Fotos do veículo/i), [
      makeJpegFile("frente.jpg"),
      makeJpegFile("painel.jpg"),
    ]);
    await user.click(screen.getByRole("button", { name: /Continuar/i }));
    await user.click(
      screen.getByLabelText(/Concordo com o tratamento dos meus dados pessoais/i),
    );
    await user.click(screen.getByRole("button", { name: /Enviar anúncio/i }));

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith("Falha qualquer");
    });
    expect(uploadUrlMock).not.toHaveBeenCalled();
  });
});
