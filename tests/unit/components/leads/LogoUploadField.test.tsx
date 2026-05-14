import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock sonner first
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

// Mock the upload Server Action
const uploadMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/lead-site", () => ({
  uploadLeadSiteLogo: uploadMock,
}));

import { LogoUploadField } from "@/components/leads/LogoUploadField";

expect.extend(toHaveNoViolations);

const SITE_ID = "33333333-3333-4333-8333-333333333333";

function makeImageFile(opts: {
  type?: string;
  size?: number;
  name?: string;
} = {}): File {
  const size = opts.size ?? 1024;
  return new File([new Uint8Array(size)], opts.name ?? "logo.png", {
    type: opts.type ?? "image/png",
  });
}

beforeEach(() => {
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  uploadMock.mockReset();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("<LogoUploadField />", () => {
  it("renderiza preview da logo atual quando currentLogoUrl é fornecido", () => {
    render(
      <LogoUploadField
        leadSiteId={SITE_ID}
        currentLogoUrl="https://cdn.example.com/old-logo.png"
      />,
    );
    const preview = screen.getByAltText("Preview da logo do site");
    expect(preview).toHaveAttribute(
      "src",
      "https://cdn.example.com/old-logo.png",
    );
  });

  it("renderiza placeholder 'Sem logo' quando currentLogoUrl é null", () => {
    render(<LogoUploadField leadSiteId={SITE_ID} currentLogoUrl={null} />);
    expect(screen.getByText(/sem logo/i)).toBeInTheDocument();
  });

  it("happy path: PNG válido dispara upload, mostra preview otimista, chama onUploaded", async () => {
    uploadMock.mockResolvedValueOnce({
      ok: true,
      logo_url: "https://cdn.example.com/visual-identity/abc/logo-deadbeef.png",
    });
    const onUploaded = vi.fn();
    const user = userEvent.setup();

    render(
      <LogoUploadField
        leadSiteId={SITE_ID}
        currentLogoUrl={null}
        onUploaded={onUploaded}
      />,
    );

    const input = screen.getByLabelText("Selecionar logo") as HTMLInputElement;
    const file = makeImageFile({ type: "image/png", size: 50_000 });
    await user.upload(input, file);

    // Aguarda Server Action resolver
    await vi.waitFor(() => {
      expect(uploadMock).toHaveBeenCalledTimes(1);
    });

    const [siteId, formData] = uploadMock.mock.calls[0]!;
    expect(siteId).toBe(SITE_ID);
    expect(formData).toBeInstanceOf(FormData);
    expect((formData as FormData).get("file")).toBe(file);

    await vi.waitFor(() => {
      expect(onUploaded).toHaveBeenCalledWith(
        "https://cdn.example.com/visual-identity/abc/logo-deadbeef.png",
      );
    });
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringMatching(/logo atualizada/i),
    );
  });

  it("rejeita MIME inválido client-side (image/gif) — não chama Server Action", async () => {
    render(<LogoUploadField leadSiteId={SITE_ID} />);

    const input = screen.getByLabelText("Selecionar logo") as HTMLInputElement;
    const file = makeImageFile({ type: "image/gif", name: "logo.gif" });
    // userEvent.upload enforces input[accept] e bloqueia GIF antes do
    // change event; em prod real um drag-and-drop entrega o file mesmo
    // com accept restritivo. fireEvent.change simula esse cenário.
    fireEvent.change(input, { target: { files: [file] } });

    expect(uploadMock).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith(
      expect.stringMatching(/formato inválido/i),
    );
  });

  it("rejeita arquivo > 2 MB client-side — não chama Server Action", async () => {
    render(<LogoUploadField leadSiteId={SITE_ID} />);

    const input = screen.getByLabelText("Selecionar logo") as HTMLInputElement;
    const big = makeImageFile({ size: 2 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [big] } });

    expect(uploadMock).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith(
      expect.stringMatching(/maior que 2 mb/i),
    );
  });

  it("Server Action error: toast error + preview mantém logo antiga", async () => {
    uploadMock.mockResolvedValueOnce({
      ok: false,
      error: "storage_error",
      message: "Falha no upload. Tente novamente.",
    });
    const user = userEvent.setup();

    render(
      <LogoUploadField
        leadSiteId={SITE_ID}
        currentLogoUrl="https://cdn.example.com/old.png"
      />,
    );

    const input = screen.getByLabelText("Selecionar logo") as HTMLInputElement;
    await user.upload(input, makeImageFile());

    await vi.waitFor(() => {
      expect(uploadMock).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        "Falha no upload. Tente novamente.",
      );
    });

    // Preview permanece com a logo antiga (não fazemos optimistic update)
    const preview = screen.getByAltText(
      "Preview da logo do site",
    ) as HTMLImageElement;
    expect(preview.src).toBe("https://cdn.example.com/old.png");
  });

  it("zero violations a11y (axe-core)", async () => {
    const { container } = render(
      <LogoUploadField
        leadSiteId={SITE_ID}
        currentLogoUrl="https://cdn.example.com/old.png"
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
