import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routerMock = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/messages",
}));

const supabaseChannel = vi.hoisted(() => ({
  on: vi.fn(),
  subscribe: vi.fn(),
}));

const supabaseClient = vi.hoisted(() => ({
  channel: vi.fn(() => supabaseChannel),
  removeChannel: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabase: () => supabaseClient,
}));

import { ConversationList } from "@/components/messages/conversation-list";
import type { ConversationItem } from "@/lib/messages/list-conversations";

beforeEach(() => {
  supabaseChannel.on.mockReset();
  supabaseChannel.subscribe.mockReset();
  supabaseChannel.on.mockReturnValue(supabaseChannel);
  supabaseChannel.subscribe.mockReturnValue(supabaseChannel);
  supabaseClient.channel.mockClear();
  supabaseClient.removeChannel.mockClear();
});

const items: ConversationItem[] = [
  {
    leadId: "lead-1",
    leadName: "Barbearia A",
    leadPhone: "5511999",
    lastContent: "Olá, tudo bem?",
    lastCreatedAt: new Date().toISOString(),
    lastDirection: "inbound",
    lastStatus: "delivered",
  },
  {
    leadId: "lead-2",
    leadName: "Restaurante B",
    leadPhone: "5511888",
    lastContent: "Obrigado!",
    lastCreatedAt: new Date().toISOString(),
    lastDirection: "outbound",
    lastStatus: "read",
  },
];

describe("ConversationList", () => {
  it("renderiza items + busca + estado vazio do filtro", async () => {
    const user = userEvent.setup();
    render(<ConversationList initial={items} selectedLeadId={null} />);
    expect(screen.getByText("Barbearia A")).toBeInTheDocument();
    expect(screen.getByText("Restaurante B")).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/buscar conversa/i);
    await user.type(input, "Barbearia");
    expect(screen.getByText("Barbearia A")).toBeInTheDocument();
    expect(screen.queryByText("Restaurante B")).toBeNull();

    await user.clear(input);
    await user.type(input, "ZZZ");
    expect(screen.queryByText("Barbearia A")).toBeNull();
    expect(screen.queryByText("Restaurante B")).toBeNull();
    expect(screen.getByText(/nenhuma conversa bate/i)).toBeInTheDocument();
  });

  it("empty state quando não há conversas", () => {
    render(<ConversationList initial={[]} selectedLeadId={null} />);
    expect(screen.getByText(/nenhuma conversa ainda/i)).toBeInTheDocument();
  });

  it("destaca selectedLeadId visualmente", () => {
    render(<ConversationList initial={items} selectedLeadId="lead-2" />);
    const link = screen.getByTestId("conversation-item-lead-2");
    expect(link.className).toMatch(/bg-accent/);
  });

  it("subscreve canal Realtime de lead_messages", () => {
    render(<ConversationList initial={items} selectedLeadId={null} />);
    expect(supabaseClient.channel).toHaveBeenCalledWith("lead_messages:list");
  });
});
