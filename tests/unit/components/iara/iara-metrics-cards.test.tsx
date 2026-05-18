import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { IaraMetricsCards } from "@/components/iara/iara-metrics-cards";

describe("IaraMetricsCards", () => {
  it("renderiza 4 cards com labels canônicos", () => {
    render(
      <IaraMetricsCards
        snapshot={{
          total: 30,
          pctP0: 10,
          pctApproved: 70,
          pctRejected: 5,
        }}
      />,
    );
    expect(screen.getByText(/Conversas totais/i)).toBeTruthy();
    expect(screen.getByText(/Com handoff P0/i)).toBeTruthy();
    expect(screen.getByText(/Aprovadas/i)).toBeTruthy();
    expect(screen.getByText(/Reprovadas/i)).toBeTruthy();

    expect(screen.getByText("30")).toBeTruthy();
    expect(screen.getByText("10%")).toBeTruthy();
    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.getByText("5%")).toBeTruthy();
  });

  it("formata 0% quando snapshot total é 0", () => {
    render(
      <IaraMetricsCards
        snapshot={{ total: 0, pctP0: 0, pctApproved: 0, pctRejected: 0 }}
      />,
    );
    expect(screen.getAllByText("0%").length).toBeGreaterThanOrEqual(3);
  });

  it("usa role=list com listitems pra acessibilidade", () => {
    render(
      <IaraMetricsCards
        snapshot={{
          total: 1,
          pctP0: 0,
          pctApproved: 100,
          pctRejected: 0,
        }}
      />,
    );
    const list = screen.getByRole("list", {
      name: /Métricas de revisão da Iara/i,
    });
    expect(list).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("arredonda percentuais (NaN vira 0%)", () => {
    render(
      <IaraMetricsCards
        snapshot={{
          total: 10,
          pctP0: 33.6,
          pctApproved: 66.4,
          pctRejected: Number.NaN,
        }}
      />,
    );
    expect(screen.getByText("34%")).toBeTruthy();
    expect(screen.getByText("66%")).toBeTruthy();
    // pctRejected = NaN ⇒ "0%"
    expect(screen.getAllByText("0%").length).toBeGreaterThanOrEqual(1);
  });
});
