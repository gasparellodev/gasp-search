"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  APPROVAL_LABEL,
  HANDOFF_ICON,
  type IaraApprovalStatus,
  type IaraConversationListItem,
  type IaraHandoffPriority,
} from "@/components/iara/types";

const APPROVAL_VARIANT: Record<
  IaraApprovalStatus,
  "default" | "secondary" | "destructive"
> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

const HANDOFF_VARIANT: Record<
  IaraHandoffPriority,
  "destructive" | "default" | "secondary" | "outline"
> = {
  P0: "destructive",
  P1: "default",
  P2: "secondary",
  P3: "outline",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface IaraReviewTableProps {
  items: IaraConversationListItem[];
  sandboxPath?: string;
  reviewEndpoint?: (id: string) => string;
  onUpdated?: (id: string, status: IaraApprovalStatus) => void;
}

export function IaraReviewTable({
  items,
  sandboxPath = "/admin/iara/sandbox",
  reviewEndpoint = (id) =>
    `/api/iara/sandbox/conversation/${id}/review`,
  onUpdated,
}: IaraReviewTableProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function patchStatus(id: string, status: IaraApprovalStatus) {
    setPendingId(id);
    try {
      const res = await fetch(reviewEndpoint(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: status }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Falha ao salvar veredito");
      }
      toast.success(
        status === "approved" ? "Conversa aprovada" : "Conversa reprovada",
      );
      onUpdated?.(id, status);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao salvar veredito",
      );
    } finally {
      setPendingId(null);
    }
  }

  const columns = useMemo<ColumnDef<IaraConversationListItem>[]>(
    () => [
      {
        id: "lead",
        header: "Lead",
        cell: ({ row }) => (
          <Link
            href={`${sandboxPath}?leadId=${row.original.leadId}`}
            className="hover:underline"
          >
            <div className="font-medium">{row.original.leadBusinessName}</div>
            <div className="text-muted-foreground text-xs">
              {row.original.leadCity ?? "—"}
            </div>
          </Link>
        ),
      },
      {
        id: "iara_version",
        header: "Iara",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono">
            {row.original.iaraVersion}
          </Badge>
        ),
      },
      {
        id: "msg_count",
        header: "Msgs",
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.messageCount}
          </span>
        ),
      },
      {
        id: "handoff",
        header: "Handoff",
        cell: ({ row }) => {
          const p = row.original.latestHandoffPriority;
          if (!p) {
            return <span className="text-muted-foreground text-sm">—</span>;
          }
          return (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true">{HANDOFF_ICON[p]}</span>
              <Badge variant={HANDOFF_VARIANT[p]}>{p}</Badge>
            </span>
          );
        },
      },
      {
        id: "approval",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={APPROVAL_VARIANT[row.original.approvalStatus]}>
            {APPROVAL_LABEL[row.original.approvalStatus]}
          </Badge>
        ),
      },
      {
        id: "updated",
        header: "Atualização",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {formatDateTime(row.original.lastMessageAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Ações</span>,
        cell: ({ row }) => {
          const id = row.original.id;
          const isPending = pendingId === id;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Aprovar conversa"
                disabled={isPending}
                onClick={() => patchStatus(id, "approved")}
              >
                <Check className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Reprovar conversa"
                disabled={isPending}
                onClick={() => patchStatus(id, "rejected")}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingId, sandboxPath, reviewEndpoint],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table retorna funções que não podem ser memoizadas com segurança; comportamento esperado.
  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (items.length === 0) {
    return (
      <div
        className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm"
        role="status"
      >
        Nenhuma conversa encontrada com os filtros atuais.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} data-testid={`iara-review-row-${row.original.id}`}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default IaraReviewTable;
