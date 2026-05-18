"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { IaraApprovalStatus } from "@/components/iara/types";

interface IaraApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "approved" ou "rejected" — definido pelo botão que abriu o modal. */
  decision: Exclude<IaraApprovalStatus, "pending">;
  defaultNotes?: string;
  onConfirm: (notes: string | null) => Promise<void> | void;
}

export function IaraApprovalDialog({
  open,
  onOpenChange,
  decision,
  defaultNotes = "",
  onConfirm,
}: IaraApprovalDialogProps) {
  const [notes, setNotes] = useState(defaultNotes);
  const [busy, setBusy] = useState(false);

  const isApprove = decision === "approved";

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm(notes.trim() ? notes.trim() : null);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isApprove ? "Aprovar conversa" : "Reprovar conversa"}
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? "Marca esta conversa como aprovada no gate de calibração da Iara."
              : "Marca esta conversa como reprovada. Use as notas para registrar o problema (tom, handoff errado, alucinação, etc.)."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <Label htmlFor="iara-approval-notes">Notas (opcional)</Label>
          <Textarea
            id="iara-approval-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: tom natural, escalou P1 corretamente quando cliente pediu desconto."
            rows={4}
            maxLength={2000}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            variant={isApprove ? "default" : "destructive"}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy
              ? "Salvando..."
              : isApprove
                ? "Confirmar aprovação"
                : "Confirmar reprovação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default IaraApprovalDialog;
