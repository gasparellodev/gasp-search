import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMock }));

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/campaigns/new",
}));

import { CampaignForm } from "@/components/campaigns/campaign-form";

const fetchMock = vi.fn<typeof fetch>();

const baseLead = {
  id: "lead-1",
  name: "Barbearia A",
  source: "google_maps" as const,
  category: "Barbearia",
  city: "São Paulo",
  state: "SP",
  country: "Brasil",
  phone: "1199",
  email: null,
  website: null,
  instagram_handle: null,
  whatsapp: null,
  has_website: null,
  rating: null,
  reviews_count: null,
  followers_count: null,
  stage: "new" as const,
  score: 0,
  notes: null,
};

beforeEach(() => {
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  routerMock.push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CampaignForm", () => {
  it("renderiza no modo template e mostra preview com primeiro lead", async () => {
    render(<CampaignForm selectedLeads={[baseLead]} />);
    expect(
      screen.getByPlaceholderText(/black friday/i),
    ).toBeInTheDocument();
    // Preview renderiza com o nome do primeiro lead — usamos o label "Preview"
    expect(screen.getByText(/preview com/i)).toHaveTextContent("Barbearia A");
  });

  it("mostra aviso de placeholders desconhecidos", async () => {
    const user = userEvent.setup();
    render(<CampaignForm selectedLeads={[baseLead]} />);
    const ta = screen.getByLabelText(/template/i) as HTMLTextAreaElement;
    await user.clear(ta);
    // userEvent.type interpreta `{` e `[`; usar paste pra inserir literal.
    await user.click(ta);
    await user.paste("Olá {{xyz}}");
    expect(
      screen.getByText(/placeholders desconhecidos/i),
    ).toBeInTheDocument();
  });

  it("alterna pra modo IA por lead", async () => {
    const user = userEvent.setup();
    render(<CampaignForm selectedLeads={[baseLead]} />);
    await user.click(screen.getByRole("radio", { name: /ia por lead/i }));
    expect(screen.getByLabelText(/objetivo/i)).toBeInTheDocument();
  });

  it("submete e redireciona pro detail", async () => {
    const user = userEvent.setup();
    render(<CampaignForm selectedLeads={[baseLead]} />);
    await user.type(
      screen.getByPlaceholderText(/black friday/i),
      "Camp X",
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ campaignId: "camp-1" }), { status: 201 }),
    );
    await user.click(screen.getByRole("button", { name: /disparar campanha/i }));
    await waitFor(() => {
      expect(routerMock.push).toHaveBeenCalledWith("/campaigns/camp-1");
    });
    expect(toastMock.success).toHaveBeenCalled();
  });

  it("desabilita submit quando sem leads ou sem nome", () => {
    render(<CampaignForm selectedLeads={[]} />);
    expect(
      screen.getByRole("button", { name: /disparar campanha/i }),
    ).toBeDisabled();
  });
});
