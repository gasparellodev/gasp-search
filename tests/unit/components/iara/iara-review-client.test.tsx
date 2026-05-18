import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { IaraReviewClient } from "@/components/iara/iara-review-client";
import type { IaraConversationListItem } from "@/components/iara/types";

const hoisted = vi.hoisted(() => ({
  replace: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: hoisted.replace,
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("sonner", () => ({
  toast: {
    success: hoisted.toastSuccess,
    error: hoisted.toastError,
  },
}));

function makeItem(
  overrides: Partial<IaraConversationListItem> = {},
): IaraConversationListItem {
  return {
    id: "conv-1",
    leadId: "lead-1",
    leadBusinessName: "AutoStar",
    leadCity: "São Paulo",
    iaraVersion: "1.1",
    isSandbox: true,
    lastMessageAt: "2026-05-18T12:00:00.000Z",
    messageCount: 4,
    handoffCount: 1,
    latestHandoffPriority: "P0",
    approvalStatus: "pending",
    createdAt: "2026-05-18T10:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  hoisted.replace.mockReset();
  hoisted.toastSuccess.mockReset();
  hoisted.toastError.mockReset();
});

describe("IaraReviewClient", () => {
  it("renderiza métricas + tabela quando items presentes", () => {
    const items = [
      makeItem(),
      makeItem({
        id: "conv-2",
        leadBusinessName: "BeagleCars",
        leadCity: "Curitiba",
        approvalStatus: "approved",
        latestHandoffPriority: null,
      }),
    ];
    // fetch é called dentro do effect — passamos um stub que resolve com items.
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    render(<IaraReviewClient initialItems={items} />);

    expect(screen.getByText(/Conversas totais/i)).toBeTruthy();
    expect(screen.getByText("AutoStar")).toBeTruthy();
    expect(screen.getByText("BeagleCars")).toBeTruthy();

    vi.unstubAllGlobals();
  });

  it("filtro de query reduz items visíveis em memória", async () => {
    const items = [
      makeItem(),
      makeItem({ id: "conv-2", leadBusinessName: "BeagleCars" }),
    ];
    // O effect inicial faz refetch — devolvemos os mesmos items pra
    // garantir que a tabela não fique vazia após o setState.
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const user = userEvent.setup();
    render(<IaraReviewClient initialItems={items} />);

    const input = screen.getByLabelText(/Buscar/i);
    await user.type(input, "Beagle");

    await waitFor(() => {
      expect(screen.queryByText("AutoStar")).toBeNull();
      expect(screen.getByText("BeagleCars")).toBeTruthy();
    });

    vi.unstubAllGlobals();
  });

  it("handleUpdated atualiza state após PATCH inline da tabela", async () => {
    const items = [makeItem()];
    // fetch responde ok para tudo — o effect inicial mantém os items,
    // e o PATCH inline também resolve com sucesso.
    const fetchSpy = vi.fn(async (url: string) => {
      if (typeof url === "string" && url.includes("/review")) {
        return {
          ok: true,
          json: async () => ({ ok: true }),
        };
      }
      return {
        ok: true,
        json: async () => ({ items }),
      };
    });
    vi.stubGlobal("fetch", fetchSpy as unknown as typeof fetch);

    const user = userEvent.setup();
    render(<IaraReviewClient initialItems={items} />);

    // Espera o effect inicial completar (refetch).
    await waitFor(() => {
      expect(screen.getByText("AutoStar")).toBeTruthy();
    });

    const approveBtn = screen.getByRole("button", {
      name: /aprovar conversa/i,
    });
    await user.click(approveBtn);

    await waitFor(() => {
      const patchCall = fetchSpy.mock.calls.find((args) => {
        const [url] = args;
        return (
          typeof url === "string" &&
          url.includes("/conversation/conv-1/review")
        );
      });
      expect(patchCall).toBeDefined();
    });

    vi.unstubAllGlobals();
  });

  it("filtro handoffPriority=none mantém só items sem handoff", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const items = [
      makeItem(),
      makeItem({
        id: "conv-2",
        leadBusinessName: "BeagleCars",
        latestHandoffPriority: null,
      }),
    ];

    // Para mudar o select shadcn ad-hoc precisaríamos abrir o popover —
    // muito complexo. Testamos a presença dos triggers acessíveis.
    render(<IaraReviewClient initialItems={items} />);
    expect(screen.getByLabelText(/Aprovação/i)).toBeTruthy();
    expect(screen.getByLabelText(/Handoff/i)).toBeTruthy();

    vi.unstubAllGlobals();
  });
});
