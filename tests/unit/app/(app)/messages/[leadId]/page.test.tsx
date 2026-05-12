/**
 * Header da rota `/messages/[leadId]` deve cruzar para `/leads/[id]`
 * (issue #137 — cross-links leads ↔ messages ↔ campaigns ↔ pipeline).
 *
 * - Nome do lead vira `<Link href="/leads/<id>">`.
 * - Badge com stage label (`STAGE_LABEL`) e variant (`STAGE_VARIANT`).
 *
 * Implementado como teste de async server component: mockamos Supabase
 * + `listConversations` e renderizamos o output direto via RTL. Mesma
 * estratégia já usada em `tests/unit/app/sites/[slug]/page.test.tsx`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const navigationMocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

const supabaseMocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
}));

const conversationsMocks = vi.hoisted(() => ({
  listConversations: vi.fn().mockResolvedValue([]),
}));

vi.mock("next/navigation", () => ({
  notFound: navigationMocks.notFound,
  redirect: navigationMocks.redirect,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => {
    const eq = vi.fn(() => ({ maybeSingle: supabaseMocks.maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    return { from };
  }),
}));

vi.mock("@/lib/messages/list-conversations", () => ({
  listConversations: conversationsMocks.listConversations,
}));

// Filhos do layout não precisam render real — viram stubs leves.
vi.mock("@/components/messages/conversation-list", () => ({
  ConversationList: () => null,
}));
vi.mock("@/components/messages/conversation-thread", () => ({
  ConversationThread: () => null,
}));
vi.mock("@/components/messages/instance-banner", () => ({
  InstanceBanner: () => null,
}));
vi.mock("@/components/messages/message-composer", () => ({
  MessageComposer: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_WHATSAPP_ENABLED = "1";
  conversationsMocks.listConversations.mockResolvedValue([]);
});

afterEach(() => {
  process.env.NEXT_PUBLIC_WHATSAPP_ENABLED = "0";
});

describe("/messages/[leadId] header — cross-link para /leads/[id]", () => {
  it("renderiza nome do lead como <Link href='/leads/<id>'> + Badge com STAGE_LABEL", async () => {
    supabaseMocks.maybeSingle.mockResolvedValue({
      data: {
        id: "lead-1",
        name: "Barbearia A",
        stage: "in_conversation",
        phone: "5511999",
      },
      error: null,
    });

    const { default: Page } = await import(
      "@/app/(app)/messages/[leadId]/page"
    );

    const ui = await Page({ params: Promise.resolve({ leadId: "lead-1" }) });
    render(ui as React.ReactElement);

    const heading = screen.getByRole("heading", {
      level: 1,
      name: /barbearia a/i,
    });
    expect(heading).toBeInTheDocument();

    const link = heading.closest("a");
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute("href", "/leads/lead-1");

    expect(screen.getByText(/^em conversa$/i)).toBeInTheDocument();
  });

  it("notFound() quando lead não existe (regressão)", async () => {
    supabaseMocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const { default: Page } = await import(
      "@/app/(app)/messages/[leadId]/page"
    );

    await expect(
      Page({ params: Promise.resolve({ leadId: "missing" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
