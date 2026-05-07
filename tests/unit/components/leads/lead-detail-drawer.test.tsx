import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LeadDetailDrawer } from "@/components/leads/lead-detail-drawer";
import type { LeadListItem } from "@/lib/leads/list-leads";

const hoisted = vi.hoisted(() => ({
  refreshSpy: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
const { refreshSpy, toastSuccess, toastError } = hoisted;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: hoisted.refreshSpy,
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: hoisted.toastSuccess, error: hoisted.toastError },
}));

const baseLead: LeadListItem = {
  id: "lead-1",
  user_id: "user-1",
  source: "google_maps",
  source_search_job_id: null,
  name: "Barbearia X",
  category: "Barbearia",
  city: "Curitiba",
  state: "PR",
  country: "BR",
  phone: "+5541999999999",
  email: null,
  website: "barbeariax.com",
  instagram_handle: null,
  whatsapp: null,
  has_website: true,
  rating: 4.5,
  reviews_count: 128,
  followers_count: null,
  stage: "new",
  score: 50,
  notes: null,
  raw: null,
  enriched_at: null,
  created_at: "2026-05-07T00:00:00Z",
  updated_at: "2026-05-07T00:00:00Z",
  tags: [{ id: "tag-1", name: "Frio", color: "#0ea5e9" }],
};

const allTags = [
  { id: "tag-1", name: "Frio", color: "#0ea5e9" },
  { id: "tag-2", name: "Quente", color: "#ef4444" },
];

const defaultProps = {
  lead: baseLead,
  open: true,
  onOpenChange: () => {},
  tags: allTags,
};

beforeEach(() => {
  refreshSpy.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LeadDetailDrawer", () => {
  it("não renderiza conteúdo quando lead é null", () => {
    render(<LeadDetailDrawer {...defaultProps} lead={null} open={false} />);
    expect(screen.queryByRole("heading", { name: /barbearia x/i })).toBeNull();
  });

  it("mostra três tabs (Visão Geral, Notas, Mensagens IA)", () => {
    render(<LeadDetailDrawer {...defaultProps} />);
    expect(screen.getByRole("tab", { name: /visão geral/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /notas/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /mensagens ia/i }),
    ).toBeInTheDocument();
  });

  it("Visão Geral mostra contatos e tags atuais", () => {
    render(<LeadDetailDrawer {...defaultProps} />);
    expect(screen.getByText("+5541999999999")).toBeInTheDocument();
    expect(screen.getByText("barbeariax.com")).toBeInTheDocument();
    expect(screen.getByText(/Frio/)).toBeInTheDocument();
  });

  it("editar stage chama PATCH e dá refresh em sucesso", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...baseLead, stage: "contacted" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LeadDetailDrawer {...defaultProps} />);
    await userEvent.selectOptions(
      screen.getByLabelText(/estágio/i),
      "contacted",
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/leads/lead-1");
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      stage: "contacted",
    });
    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalled();
    });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("optimistic update reverte quando PATCH falha", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, json: async () => ({ error: "boom" }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<LeadDetailDrawer {...defaultProps} />);
    const select = screen.getByLabelText(/estágio/i);
    await userEvent.selectOptions(select, "contacted");

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    // Após o rollback o select volta a "new" (estado original)
    expect(select).toHaveValue("new");
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it("editar score envia PATCH com novo valor", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...baseLead, score: 80 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LeadDetailDrawer {...defaultProps} />);
    const scoreInput = screen.getByLabelText(/score/i);
    await userEvent.clear(scoreInput);
    await userEvent.type(scoreInput, "80");
    scoreInput.blur();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({
      score: 80,
    });
  });

  it("salvar notes na tab Notas envia PATCH", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...baseLead, notes: "lead muito frio" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LeadDetailDrawer {...defaultProps} />);
    await userEvent.click(screen.getByRole("tab", { name: /notas/i }));
    const textarea = screen.getByLabelText(/notas internas/i);
    await userEvent.type(textarea, "lead muito frio");
    await userEvent.click(
      screen.getByRole("button", { name: /salvar notas/i }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({
      notes: "lead muito frio",
    });
  });

  it("Mensagens IA mostra placeholder enquanto issue #33 não chega", async () => {
    render(<LeadDetailDrawer {...defaultProps} />);
    await userEvent.click(screen.getByRole("tab", { name: /mensagens ia/i }));
    expect(screen.getByText(/em breve/i)).toBeInTheDocument();
  });

  it("clicar Fechar dispara onOpenChange(false)", async () => {
    const onOpenChange = vi.fn();
    render(
      <LeadDetailDrawer {...defaultProps} onOpenChange={onOpenChange} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /fechar/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
