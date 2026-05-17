import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { AboutTeam } from "@/components/sites/about/AboutTeam";

expect.extend(toHaveNoViolations);

const MEMBERS = [
  {
    name: "João Silva",
    role: "Gerente Comercial",
    photo_url: "https://cdn.example.com/team/joao.jpg",
    bio: "10 anos de experiência no mercado automotivo.",
  },
  {
    name: "Maria Souza",
    role: "Vendedora Sênior",
    photo_url: null,
    bio: null,
  },
  {
    name: "Carlos Lima",
    role: "Chefe de Mecânica",
    photo_url: "https://cdn.example.com/team/carlos.jpg",
    bio: undefined,
  },
];

describe("<AboutTeam />", () => {
  it("renderiza <section> com aria-labelledby apontando para o heading quando members presentes", () => {
    render(<AboutTeam members={MEMBERS} />);
    const section = screen.getByRole("region", { name: /nossa equipe/i });
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute("aria-labelledby", "team-heading");
  });

  it("renderiza heading 'Nossa equipe'", () => {
    render(<AboutTeam members={MEMBERS} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /nossa equipe/i }),
    ).toBeInTheDocument();
  });

  it("renderiza nome e cargo de cada membro", () => {
    render(<AboutTeam members={MEMBERS} />);
    for (const member of MEMBERS) {
      expect(screen.getByText(member.name)).toBeInTheDocument();
      expect(screen.getByText(member.role)).toBeInTheDocument();
    }
  });

  it("renderiza imagem com alt 'Foto de {name}' quando photo_url presente", () => {
    render(<AboutTeam members={MEMBERS} />);
    expect(
      screen.getByAltText("Foto de João Silva"),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText("Foto de Carlos Lima"),
    ).toBeInTheDocument();
  });

  it("não renderiza img quando photo_url é null", () => {
    render(<AboutTeam members={[MEMBERS[1]!]} />);
    // Maria Souza has no photo — no img element expected
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renderiza bio quando presente", () => {
    render(<AboutTeam members={MEMBERS} />);
    expect(
      screen.getByText("10 anos de experiência no mercado automotivo."),
    ).toBeInTheDocument();
  });

  it("retorna null quando members está vazio", () => {
    const { container } = render(<AboutTeam members={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza um card por membro como article", () => {
    render(<AboutTeam members={MEMBERS} />);
    const articles = document.querySelectorAll("article");
    expect(articles).toHaveLength(MEMBERS.length);
  });

  it("não tem violações axe-core", async () => {
    const { container } = render(<AboutTeam members={MEMBERS} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
