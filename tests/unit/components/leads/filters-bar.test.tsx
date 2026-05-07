import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FiltersBar } from "@/components/leads/filters-bar";
import type { LeadTagSummary } from "@/lib/leads/list-leads";

const pushSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy, replace: pushSpy, refresh: vi.fn() }),
  usePathname: () => "/leads",
  useSearchParams: () => new URLSearchParams(),
}));

const tags: LeadTagSummary[] = [
  { id: "tag-frio", name: "Frio", color: "#0ea5e9" },
  { id: "tag-quente", name: "Quente", color: "#ef4444" },
  { id: "tag-vip", name: "VIP", color: "#f59e0b" },
];

const defaultFilters = {
  q: undefined,
  stage: undefined,
  source: undefined,
  hasWebsite: undefined,
  tagIds: undefined,
};

describe("FiltersBar", () => {
  beforeEach(() => {
    pushSpy.mockReset();
  });

  it("renderiza inputs para q, stage, source, hasWebsite e tags", () => {
    render(<FiltersBar tags={tags} filters={defaultFilters} />);
    expect(screen.getByLabelText(/buscar pelo nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/estágio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/origem/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/site/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /tags/i }),
    ).toBeInTheDocument();
  });

  it("alterar stage atualiza URL com stage e reseta page=1", async () => {
    render(<FiltersBar tags={tags} filters={defaultFilters} />);
    await userEvent.selectOptions(
      screen.getByLabelText(/estágio/i),
      "contacted",
    );
    expect(pushSpy).toHaveBeenCalledTimes(1);
    const url = pushSpy.mock.calls[0]![0] as string;
    expect(url).toContain("stage=contacted");
    expect(url).toContain("page=1");
  });

  it("alterar source atualiza URL", async () => {
    render(<FiltersBar tags={tags} filters={defaultFilters} />);
    await userEvent.selectOptions(
      screen.getByLabelText(/origem/i),
      "google_maps",
    );
    expect(pushSpy.mock.calls[0]![0]).toContain("source=google_maps");
  });

  it("alterar hasWebsite (yes/no/any) atualiza URL", async () => {
    render(<FiltersBar tags={tags} filters={defaultFilters} />);
    await userEvent.selectOptions(screen.getByLabelText(/site/i), "true");
    expect(pushSpy.mock.calls[0]![0]).toContain("hasWebsite=true");
    pushSpy.mockReset();
    await userEvent.selectOptions(screen.getByLabelText(/site/i), "false");
    expect(pushSpy.mock.calls[0]![0]).toContain("hasWebsite=false");
  });

  it("digitar e submeter q atualiza URL com q (debounced via form submit)", async () => {
    render(<FiltersBar tags={tags} filters={defaultFilters} />);
    const input = screen.getByLabelText(/buscar pelo nome/i);
    await userEvent.type(input, "barbearia");
    await userEvent.keyboard("{Enter}");
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0]![0]).toContain("q=barbearia");
  });

  it("combobox de tags suporta multi-select e atualiza URL com tagId repetido", async () => {
    render(<FiltersBar tags={tags} filters={defaultFilters} />);
    await userEvent.click(screen.getByRole("button", { name: /tags/i }));

    await userEvent.click(
      await screen.findByRole("option", { name: /frio/i }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: /vip/i }),
    );
    // Fechar popover para disparar push
    await userEvent.keyboard("{Escape}");

    expect(pushSpy).toHaveBeenCalled();
    const url = pushSpy.mock.calls.at(-1)![0] as string;
    expect(url).toMatch(/tagId=tag-frio/);
    expect(url).toMatch(/tagId=tag-vip/);
  });

  it("botão Limpar filtros remove todas as keys de filtro mantendo sortBy/sortDir", async () => {
    render(
      <FiltersBar
        tags={tags}
        filters={{
          q: "barbearia",
          stage: "new",
          source: "google_maps",
          hasWebsite: true,
          tagIds: ["tag-frio"],
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /limpar/i }));
    expect(pushSpy).toHaveBeenCalledTimes(1);
    const url = pushSpy.mock.calls[0]![0] as string;
    expect(url).not.toContain("q=");
    expect(url).not.toContain("stage=");
    expect(url).not.toContain("source=");
    expect(url).not.toContain("hasWebsite=");
    expect(url).not.toContain("tagId=");
    expect(url).toContain("page=1");
  });

  it("reflete os filtros vindos do server (state inicial vem dos search params)", () => {
    render(
      <FiltersBar
        tags={tags}
        filters={{
          q: "estética",
          stage: "qualified",
          source: "instagram",
          hasWebsite: false,
          tagIds: ["tag-quente"],
        }}
      />,
    );

    expect(screen.getByLabelText(/buscar pelo nome/i)).toHaveValue("estética");
    expect(screen.getByLabelText(/estágio/i)).toHaveValue("qualified");
    expect(screen.getByLabelText(/origem/i)).toHaveValue("instagram");
    expect(screen.getByLabelText(/site/i)).toHaveValue("false");
    // O botão de tags mostra contagem
    expect(
      screen.getByRole("button", { name: /tags.*1/i }),
    ).toBeInTheDocument();
  });
});
