/**
 * `<TargetStatusTable />` — nomes de lead viram cross-links para
 * `/leads/[id]` (issue #137).
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import {
  TargetStatusTable,
  type TargetRow,
} from "@/components/campaigns/target-status-table";

const baseTargets: TargetRow[] = [
  {
    lead_id: "lead-1",
    lead_name: "Barbearia A",
    status: "sent",
    error_message: null,
    sent_message_id: "msg-1",
  },
  {
    lead_id: "lead-2",
    lead_name: null,
    status: "failed",
    error_message: "Número inválido",
    sent_message_id: null,
  },
];

describe("TargetStatusTable — cross-links para /leads/[id]", () => {
  it("renderiza nome do lead como <Link> para /leads/<id>", () => {
    render(<TargetStatusTable targets={baseTargets} />);

    const link = screen.getByRole("link", { name: /barbearia a/i });
    expect(link).toHaveAttribute("href", "/leads/lead-1");
  });

  it("usa fallback de lead_id quando lead_name é null, ainda linkando", () => {
    render(<TargetStatusTable targets={baseTargets} />);

    // Linha sem nome — o link deve mostrar os 8 primeiros chars do id.
    const link = screen.getByRole("link", { name: /lead-2/i });
    expect(link).toHaveAttribute("href", "/leads/lead-2");
  });

  it("vazio: mostra mensagem de fallback sem links", () => {
    render(<TargetStatusTable targets={[]} />);
    expect(
      screen.getByText(/nenhum target nesta campanha/i),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("status visual permanece — sent renderiza 'enviado'", () => {
    render(<TargetStatusTable targets={baseTargets} />);
    const table = screen.getByTestId("target-status-table");
    expect(within(table).getByText(/enviado/i)).toBeInTheDocument();
    expect(within(table).getByText(/falhou/i)).toBeInTheDocument();
  });
});
