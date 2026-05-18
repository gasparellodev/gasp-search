import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { IaraApprovalDialog } from "@/components/iara/iara-approval-dialog";

describe("IaraApprovalDialog", () => {
  it("renderiza copy de aprovar quando decision=approved", () => {
    render(
      <IaraApprovalDialog
        open
        onOpenChange={() => {}}
        decision="approved"
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("Aprovar conversa")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /confirmar aprovação/i }),
    ).toBeTruthy();
  });

  it("renderiza copy de reprovar quando decision=rejected", () => {
    render(
      <IaraApprovalDialog
        open
        onOpenChange={() => {}}
        decision="rejected"
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("Reprovar conversa")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /confirmar reprovação/i }),
    ).toBeTruthy();
  });

  it("ao clicar em Confirmar, chama onConfirm com notas trim", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <IaraApprovalDialog
        open
        onOpenChange={onOpenChange}
        decision="approved"
        onConfirm={onConfirm}
      />,
    );
    await user.type(
      screen.getByLabelText(/Notas \(opcional\)/i),
      "   tom natural   ",
    );
    await user.click(
      screen.getByRole("button", { name: /confirmar aprovação/i }),
    );
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("tom natural");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("envia null quando notas vazia", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <IaraApprovalDialog
        open
        onOpenChange={() => {}}
        decision="approved"
        onConfirm={onConfirm}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /confirmar aprovação/i }),
    );
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(null);
    });
  });

  it("Cancelar fecha o modal sem chamar onConfirm", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <IaraApprovalDialog
        open
        onOpenChange={onOpenChange}
        decision="rejected"
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
