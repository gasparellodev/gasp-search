import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LeadDetailDrawer } from "@/components/leads/lead-detail-drawer";
import type { LeadListItem } from "@/lib/leads/list-leads";

const lead: LeadListItem = {
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

describe("LeadDetailDrawer", () => {
  it("não renderiza conteúdo quando lead é null", () => {
    render(
      <LeadDetailDrawer lead={null} open={false} onOpenChange={() => {}} />,
    );
    expect(screen.queryByRole("heading", { name: /barbearia x/i })).toBeNull();
  });

  it("mostra nome, categoria, cidade e contatos quando aberto", () => {
    render(
      <LeadDetailDrawer lead={lead} open={true} onOpenChange={() => {}} />,
    );

    expect(
      screen.getByRole("heading", { name: /barbearia x/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/curitiba\s*\/\s*PR/i)).toBeInTheDocument();
    // category aparece exatamente como "Barbearia" (sem o " X" do nome)
    expect(screen.getByText(/^Barbearia$/)).toBeInTheDocument();
    expect(screen.getByText("+5541999999999")).toBeInTheDocument();
    expect(screen.getByText("barbeariax.com")).toBeInTheDocument();
    expect(screen.getByText(/Frio/)).toBeInTheDocument();
  });

  it("dispara onOpenChange(false) quando o usuário clica em Fechar", async () => {
    const onOpenChange = vi.fn();
    render(
      <LeadDetailDrawer
        lead={lead}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /fechar/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
