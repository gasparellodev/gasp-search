import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Funnel } from "@/components/dashboard/funnel";

describe("Funnel", () => {
  it("renderiza skeleton enquanto data é null", () => {
    render(<Funnel data={null} />);
    expect(screen.getByTestId("funnel-skeleton")).toBeInTheDocument();
  });

  it("renderiza empty state quando todos os estágios têm zero leads", () => {
    render(
      <Funnel
        data={[
          { stage: "new", count: 0, dropRate: null },
          { stage: "contacted", count: 0, dropRate: null },
          { stage: "in_conversation", count: 0, dropRate: null },
          { stage: "qualified", count: 0, dropRate: null },
          { stage: "closed_won", count: 0, dropRate: null },
        ]}
      />,
    );
    expect(screen.getByText(/Sem leads no funil/i)).toBeInTheDocument();
  });

  it("renderiza 5 estágios com count e dropRate formatado", () => {
    render(
      <Funnel
        data={[
          { stage: "new", count: 100, dropRate: null },
          { stage: "contacted", count: 80, dropRate: 0.2 },
          { stage: "in_conversation", count: 60, dropRate: 0.25 },
          { stage: "qualified", count: 40, dropRate: 1 / 3 },
          { stage: "closed_won", count: 30, dropRate: 0.25 },
        ]}
      />,
    );

    expect(screen.getByText("Novo")).toBeInTheDocument();
    expect(screen.getByText("Contatado")).toBeInTheDocument();
    expect(screen.getByText("Em conversa")).toBeInTheDocument();
    expect(screen.getByText("Qualificado")).toBeInTheDocument();
    expect(screen.getByText("Ganho")).toBeInTheDocument();

    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();

    expect(screen.getByText("-20%")).toBeInTheDocument();
    expect(screen.getByText("-33%")).toBeInTheDocument();
    expect(screen.getAllByText("-25%")).toHaveLength(2);

    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(5);
    expect(bars[0]).toHaveAttribute("aria-valuenow", "100");
    expect(bars[1]).toHaveAttribute("aria-valuenow", "80");
    expect(bars[4]).toHaveAttribute("aria-valuenow", "30");
  });

  it("mostra aumento positivo quando estágio cresce vs anterior", () => {
    render(
      <Funnel
        data={[
          { stage: "new", count: 10, dropRate: null },
          { stage: "contacted", count: 20, dropRate: -1 },
          { stage: "in_conversation", count: 5, dropRate: 0.75 },
          { stage: "qualified", count: 2, dropRate: 0.6 },
          { stage: "closed_won", count: 1, dropRate: 0.5 },
        ]}
      />,
    );
    expect(screen.getByText("+100%")).toBeInTheDocument();
  });
});
