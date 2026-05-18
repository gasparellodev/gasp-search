import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { IaraReviewTable } from "@/components/iara/iara-review-table";
import type { IaraConversationListItem } from "@/components/iara/types";

const hoisted = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: hoisted.toastSuccess,
    error: hoisted.toastError,
  },
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
  hoisted.toastSuccess.mockReset();
  hoisted.toastError.mockReset();
});

describe("IaraReviewTable", () => {
  it("renderiza empty state quando items vazio", () => {
    render(<IaraReviewTable items={[]} />);
    expect(
      screen.getByText(/Nenhuma conversa encontrada/i),
    ).toBeTruthy();
  });

  it("renderiza linha por conversa com badges de status", () => {
    render(<IaraReviewTable items={[makeItem()]} />);
    expect(screen.getByText("AutoStar")).toBeTruthy();
    expect(screen.getByText("São Paulo")).toBeTruthy();
    expect(screen.getByText("Aguardando revisão")).toBeTruthy();
    expect(screen.getByText("P0")).toBeTruthy();
  });

  it("ação 'Aprovar' dispara PATCH e mostra toast", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const onUpdated = vi.fn();
    const user = userEvent.setup();
    render(<IaraReviewTable items={[makeItem()]} onUpdated={onUpdated} />);

    await user.click(
      screen.getByRole("button", { name: /aprovar conversa/i }),
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/iara/sandbox/conversation/conv-1/review",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ approvalStatus: "approved" }),
        }),
      );
      expect(hoisted.toastSuccess).toHaveBeenCalled();
      expect(onUpdated).toHaveBeenCalledWith("conv-1", "approved");
    });

    vi.unstubAllGlobals();
  });

  it("ação 'Reprovar' falhando mostra toast de erro", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "deu ruim" }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const user = userEvent.setup();
    render(<IaraReviewTable items={[makeItem()]} />);

    await user.click(
      screen.getByRole("button", { name: /reprovar conversa/i }),
    );

    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalledWith("deu ruim");
    });

    vi.unstubAllGlobals();
  });

  it("renderiza '—' quando lead não tem cidade", () => {
    render(
      <IaraReviewTable items={[makeItem({ leadCity: null })]} />,
    );
    const row = screen.getByTestId("iara-review-row-conv-1");
    expect(row.textContent).toContain("—");
  });
});
