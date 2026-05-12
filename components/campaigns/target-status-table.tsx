"use client";

import Link from "next/link";
import { CheckCircle2, Clock, MinusCircle, TriangleAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type TargetRow = {
  lead_id: string;
  lead_name?: string | null;
  status: "pending" | "sent" | "failed" | "skipped";
  error_message: string | null;
  sent_message_id: string | null;
};

type Props = {
  targets: TargetRow[];
};

function StatusCell({ status }: { status: TargetRow["status"] }) {
  if (status === "sent") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3.5" /> enviado
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <TriangleAlert className="size-3.5" /> falhou
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <MinusCircle className="size-3.5" /> ignorado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Clock className="size-3.5" /> pendente
    </span>
  );
}

export function TargetStatusTable({ targets }: Props) {
  return (
    <Card data-testid="target-status-table">
      <CardHeader>
        <CardTitle>Status por lead</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  Nenhum target nesta campanha.
                </TableCell>
              </TableRow>
            ) : (
              targets.map((t) => (
                <TableRow key={t.lead_id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/leads/${t.lead_id}`}
                      className="hover:underline"
                    >
                      {t.lead_name ?? t.lead_id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusCell status={t.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.status === "failed" && t.error_message
                      ? t.error_message
                      : t.status === "sent"
                        ? "✓"
                        : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
