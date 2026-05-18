import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  IaraConversationsList,
  type SandboxLeadOption,
} from "@/components/iara/iara-conversations-list";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const LEADS: SandboxLeadOption[] = [
  {
    id: "lead-1",
    business_name: "AutoStar Veículos",
    city: "São Paulo",
    hasConversation: true,
  },
  {
    id: "lead-2",
    business_name: "BeagleCars",
    city: "Curitiba",
    hasConversation: false,
  },
  {
    id: "lead-3",
    business_name: "Cidade Motors",
    city: null,
    hasConversation: false,
  },
];

describe("IaraConversationsList", () => {
  it("renderiza todos os leads passados", () => {
    render(<IaraConversationsList leads={LEADS} selectedLeadId={null} />);
    expect(screen.getByText("AutoStar Veículos")).toBeTruthy();
    expect(screen.getByText("BeagleCars")).toBeTruthy();
    expect(screen.getByText("Cidade Motors")).toBeTruthy();
  });

  it("destaca o lead selecionado com aria-current", () => {
    render(<IaraConversationsList leads={LEADS} selectedLeadId="lead-2" />);
    const link = screen
      .getByTestId("lead-list-item-lead-2")
      .closest("a");
    expect(link?.getAttribute("aria-current")).toBe("page");
  });

  it("indicador • aparece quando lead tem conversa", () => {
    render(<IaraConversationsList leads={LEADS} selectedLeadId={null} />);
    const item = screen.getByTestId("lead-list-item-lead-1");
    expect(item.querySelector("[aria-label='Já tem conversa Iara']")).toBeTruthy();
    const noConv = screen.getByTestId("lead-list-item-lead-2");
    expect(
      noConv.querySelector("[aria-label='Já tem conversa Iara']"),
    ).toBeFalsy();
  });

  it("filtra resultados via search input", async () => {
    const user = userEvent.setup();
    render(<IaraConversationsList leads={LEADS} selectedLeadId={null} />);
    const input = screen.getByLabelText(/Buscar lead/i);
    await user.type(input, "Beagle");
    expect(screen.queryByText("AutoStar Veículos")).toBeNull();
    expect(screen.getByText("BeagleCars")).toBeTruthy();
  });

  it("mostra empty state quando filtro não casa nada", async () => {
    const user = userEvent.setup();
    render(<IaraConversationsList leads={LEADS} selectedLeadId={null} />);
    const input = screen.getByLabelText(/Buscar lead/i);
    await user.type(input, "xyz-no-match");
    expect(screen.getByText(/Nenhum lead encontrado/i)).toBeTruthy();
  });

  it("link aponta pra basePath?leadId=...", () => {
    render(
      <IaraConversationsList
        leads={LEADS}
        selectedLeadId={null}
        basePath="/custom/path"
      />,
    );
    const link = screen
      .getByTestId("lead-list-item-lead-1")
      .closest("a");
    expect(link?.getAttribute("href")).toBe("/custom/path?leadId=lead-1");
  });
});
