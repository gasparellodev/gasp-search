import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceBreakdown } from "@/components/dashboard/source-breakdown";

describe("SourceBreakdown", () => {
  it("renderiza skeleton enquanto data é null", () => {
    render(<SourceBreakdown data={null} />);
    expect(
      screen.getByTestId("source-breakdown-skeleton"),
    ).toBeInTheDocument();
  });

  it("renderiza empty state quando data é lista vazia", () => {
    render(<SourceBreakdown data={[]} />);
    expect(
      screen.getByText(/Nenhum lead capturado ainda/i),
    ).toBeInTheDocument();
  });

  it("renderiza uma barra por fonte com total, ganhos e conversão", () => {
    render(
      <SourceBreakdown
        data={[
          {
            source: "google_maps",
            total: 40,
            closedWon: 10,
            conversionRate: 0.25,
          },
          {
            source: "instagram",
            total: 20,
            closedWon: 4,
            conversionRate: 0.2,
          },
        ]}
      />,
    );

    expect(screen.getByText("Google Maps")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText("40 leads")).toBeInTheDocument();
    expect(screen.getByText("20 leads")).toBeInTheDocument();
    expect(screen.getByText("10 ganhos")).toBeInTheDocument();
    expect(screen.getByText("4 ganhos")).toBeInTheDocument();
    expect(screen.getByText("25% conversão")).toBeInTheDocument();
    expect(screen.getByText("20% conversão")).toBeInTheDocument();

    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute("aria-valuenow", "100");
    expect(bars[1]).toHaveAttribute("aria-valuenow", "50");
  });
});
