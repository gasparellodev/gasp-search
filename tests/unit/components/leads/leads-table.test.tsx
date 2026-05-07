import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LeadsTable } from "@/components/leads/leads-table";
import type { LeadListItem } from "@/lib/leads/list-leads";

const pushSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy, replace: pushSpy, refresh: vi.fn() }),
  usePathname: () => "/leads",
  useSearchParams: () => new URLSearchParams(),
}));

const baseLead: LeadListItem = {
  id: "lead-1",
  user_id: "user-1",
  source: "google_maps",
  source_search_job_id: null,
  name: "Barbearia Alfa",
  category: "Barbearia",
  city: "Curitiba",
  state: "PR",
  country: "BR",
  phone: "+5541999999999",
  email: "alfa@example.com",
  website: "alfa.com",
  instagram_handle: null,
  whatsapp: null,
  has_website: true,
  rating: 4.5,
  reviews_count: 80,
  followers_count: null,
  stage: "new",
  score: 42,
  notes: null,
  raw: null,
  enriched_at: null,
  created_at: "2026-05-07T00:00:00Z",
  updated_at: "2026-05-07T00:00:00Z",
  tags: [{ id: "tag-1", name: "Quente", color: "#ef4444" }],
};

const secondLead: LeadListItem = {
  ...baseLead,
  id: "lead-2",
  name: "Estética Beta",
  category: null,
  city: "São Paulo",
  state: "SP",
  phone: null,
  email: null,
  website: null,
  stage: "contacted",
  score: 15,
  tags: [],
};

const defaultProps = {
  leads: [baseLead, secondLead],
  totalCount: 2,
  page: 1,
  pageSize: 25 as const,
  totalPages: 1,
  sortBy: "created_at" as const,
  sortDir: "desc" as const,
  tags: [{ id: "tag-1", name: "Quente", color: "#ef4444" }],
};

describe("LeadsTable", () => {
  beforeEach(() => {
    pushSpy.mockReset();
  });

  it("mostra estado vazio quando não há leads", () => {
    render(
      <LeadsTable
        {...defaultProps}
        leads={[]}
        totalCount={0}
        totalPages={0}
      />,
    );
    expect(screen.getByText(/nenhum lead encontrado/i)).toBeInTheDocument();
  });

  it("renderiza linhas com nome, categoria, cidade, estágio, score e tags", () => {
    render(<LeadsTable {...defaultProps} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Barbearia Alfa")).toBeInTheDocument();
    expect(screen.getByText("Estética Beta")).toBeInTheDocument();

    const alphaRow = screen.getByText("Barbearia Alfa").closest("tr")!;
    // Categoria "Barbearia" (exata, sem o " Alfa")
    expect(within(alphaRow).getByText(/^Barbearia$/)).toBeInTheDocument();
    expect(within(alphaRow).getByText(/Curitiba/)).toBeInTheDocument();
    expect(within(alphaRow).getByText(/Novo/)).toBeInTheDocument();
    expect(within(alphaRow).getByText("42")).toBeInTheDocument();
    expect(within(alphaRow).getByText("Quente")).toBeInTheDocument();
  });

  it("clicar em uma linha abre o drawer com o lead correspondente", async () => {
    render(<LeadsTable {...defaultProps} />);

    await userEvent.click(screen.getByText("Barbearia Alfa"));

    expect(
      screen.getByRole("heading", { name: /barbearia alfa/i }),
    ).toBeInTheDocument();
  });

  it("clicar no header de coluna sortable atualiza URL com sortBy/sortDir", async () => {
    render(<LeadsTable {...defaultProps} />);

    await userEvent.click(
      screen.getByRole("button", { name: /ordenar por nome/i }),
    );

    expect(pushSpy).toHaveBeenCalledTimes(1);
    const target = pushSpy.mock.calls[0]![0] as string;
    expect(target).toContain("sortBy=name");
    expect(target).toContain("sortDir=asc");
    expect(target).toMatch(/^\/leads\?/);
  });

  it("alternar do mesmo header sortable inverte direção", async () => {
    render(
      <LeadsTable {...defaultProps} sortBy="name" sortDir="asc" />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /ordenar por nome/i }),
    );

    expect(pushSpy).toHaveBeenCalledTimes(1);
    const target = pushSpy.mock.calls[0]![0] as string;
    expect(target).toContain("sortBy=name");
    expect(target).toContain("sortDir=desc");
  });

  it("trocar pageSize atualiza URL e reseta page para 1", async () => {
    render(<LeadsTable {...defaultProps} page={3} totalPages={4} />);

    const select = screen.getByLabelText(/itens por página/i);
    await userEvent.selectOptions(select, "50");

    expect(pushSpy).toHaveBeenCalledTimes(1);
    const target = pushSpy.mock.calls[0]![0] as string;
    expect(target).toContain("pageSize=50");
    expect(target).toContain("page=1");
  });

  it("Próxima incrementa page e Anterior decrementa", async () => {
    render(<LeadsTable {...defaultProps} page={2} totalPages={4} />);

    await userEvent.click(screen.getByRole("button", { name: /próxima/i }));
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0]![0] as string).toContain("page=3");

    pushSpy.mockReset();

    await userEvent.click(screen.getByRole("button", { name: /anterior/i }));
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0]![0] as string).toContain("page=1");
  });

  it("desabilita Anterior na primeira página e Próxima na última", () => {
    const { rerender } = render(
      <LeadsTable {...defaultProps} page={1} totalPages={3} />,
    );
    expect(
      screen.getByRole("button", { name: /anterior/i }),
    ).toBeDisabled();

    rerender(<LeadsTable {...defaultProps} page={3} totalPages={3} />);
    expect(screen.getByRole("button", { name: /próxima/i })).toBeDisabled();
  });
});
