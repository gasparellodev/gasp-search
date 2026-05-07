"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

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
import { LeadDetailDrawer } from "@/components/leads/lead-detail-drawer";
import {
  LEAD_PAGE_SIZE_OPTIONS,
  type LeadPageSize,
  type LeadSortableColumn,
} from "@/lib/validators/leads";
import type { LeadListItem } from "@/lib/leads/list-leads";

interface LeadsTableProps {
  leads: LeadListItem[];
  totalCount: number;
  page: number;
  pageSize: LeadPageSize;
  totalPages: number;
  sortBy: LeadSortableColumn;
  sortDir: "asc" | "desc";
}

const STAGE_LABEL: Record<LeadListItem["stage"], string> = {
  new: "Novo",
  contacted: "Contatado",
  in_conversation: "Em conversa",
  qualified: "Qualificado",
  closed_won: "Ganho",
  closed_lost: "Perdido",
};

const STAGE_VARIANT: Record<
  LeadListItem["stage"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  new: "secondary",
  contacted: "outline",
  in_conversation: "outline",
  qualified: "default",
  closed_won: "default",
  closed_lost: "destructive",
};

function bestContact(lead: LeadListItem): string {
  if (lead.email) return lead.email;
  if (lead.phone) return lead.phone;
  if (lead.whatsapp) return lead.whatsapp;
  if (lead.website) return lead.website;
  if (lead.instagram_handle) return `@${lead.instagram_handle}`;
  return "—";
}

function formatLocation(lead: LeadListItem): string {
  const parts = [lead.city, lead.state].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(" / ") : "—";
}

interface SortableHeaderProps {
  column: LeadSortableColumn;
  label: string;
  current: LeadSortableColumn;
  dir: "asc" | "desc";
  onToggle: (column: LeadSortableColumn) => void;
}

function SortableHeader({
  column,
  label,
  current,
  dir,
  onToggle,
}: SortableHeaderProps) {
  const isActive = current === column;
  const Icon = isActive ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-8 px-2 font-medium"
      aria-label={`Ordenar por ${label.toLowerCase()}`}
      onClick={() => onToggle(column)}
    >
      <span>{label}</span>
      <Icon className="ml-1 size-3.5" aria-hidden="true" />
    </Button>
  );
}

export function LeadsTable({
  leads,
  totalCount,
  page,
  pageSize,
  totalPages,
  sortBy,
  sortDir,
}: LeadsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeLead, setActiveLead] = useState<LeadListItem | null>(null);

  function pushParams(updates: Record<string, string | number>) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [key, value] of Object.entries(updates)) {
      params.set(key, String(value));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleSort(column: LeadSortableColumn) {
    if (sortBy === column) {
      pushParams({
        sortBy: column,
        sortDir: sortDir === "asc" ? "desc" : "asc",
        page: 1,
      });
    } else {
      pushParams({ sortBy: column, sortDir: "asc", page: 1 });
    }
  }

  function changePageSize(value: string) {
    const next = Number(value) as LeadPageSize;
    pushParams({ pageSize: next, page: 1 });
  }

  function goToPage(next: number) {
    pushParams({ page: next });
  }

  const columns = useMemo<ColumnDef<LeadListItem>[]>(
    () => [
      {
        id: "name",
        header: () => (
          <SortableHeader
            column="name"
            label="Nome"
            current={sortBy}
            dir={sortDir}
            onToggle={toggleSort}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: "category",
        header: () => (
          <SortableHeader
            column="category"
            label="Categoria"
            current={sortBy}
            dir={sortDir}
            onToggle={toggleSort}
          />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.category ?? "—"}
          </span>
        ),
      },
      {
        id: "city",
        header: () => (
          <SortableHeader
            column="city"
            label="Cidade"
            current={sortBy}
            dir={sortDir}
            onToggle={toggleSort}
          />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatLocation(row.original)}
          </span>
        ),
      },
      {
        id: "contact",
        header: () => <span className="px-2">Contato</span>,
        cell: ({ row }) => (
          <span className="text-muted-foreground truncate">
            {bestContact(row.original)}
          </span>
        ),
      },
      {
        id: "stage",
        header: () => (
          <SortableHeader
            column="stage"
            label="Estágio"
            current={sortBy}
            dir={sortDir}
            onToggle={toggleSort}
          />
        ),
        cell: ({ row }) => (
          <Badge variant={STAGE_VARIANT[row.original.stage]}>
            {STAGE_LABEL[row.original.stage]}
          </Badge>
        ),
      },
      {
        id: "tags",
        header: () => <span className="px-2">Tags</span>,
        cell: ({ row }) => {
          const tags = row.original.tags;
          if (tags.length === 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  style={{ borderColor: tag.color, color: tag.color }}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        id: "score",
        header: () => (
          <SortableHeader
            column="score"
            label="Score"
            current={sortBy}
            dir={sortDir}
            onToggle={toggleSort}
          />
        ),
        cell: ({ row }) => (
          <span className="text-foreground font-medium">
            {row.original.score}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Ações</span>,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Abrir ${row.original.name}`}
            onClick={(event) => {
              event.stopPropagation();
              setActiveLead(row.original);
            }}
          >
            Abrir
          </Button>
        ),
      },
    ],
    // toggleSort/setActiveLead use closures over current props — ok to depend on sort state
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortBy, sortDir],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table retorna funções que não podem ser memoizadas com segurança; comportamento esperado.
  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (leads.length === 0) {
    return (
      <div className="border-border bg-card text-card-foreground rounded-lg border p-12 text-center">
        <p className="text-base font-medium">Nenhum lead encontrado</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Faça uma nova busca em <strong>Buscar</strong> para captar leads.
        </p>
      </div>
    );
  }

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(rangeStart + leads.length - 1, totalCount);

  return (
    <>
      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => setActiveLead(row.original)}
              >
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

      <div className="text-muted-foreground flex flex-col gap-3 px-1 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          Mostrando <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong>{" "}
          de <strong>{totalCount}</strong>
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-xs">Itens por página</span>
            <select
              aria-label="Itens por página"
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              value={pageSize}
              onChange={(event) => changePageSize(event.target.value)}
            >
              {LEAD_PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            Anterior
          </Button>
          <span className="text-xs">
            Página {page} de {Math.max(totalPages, 1)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>

      <LeadDetailDrawer
        lead={activeLead}
        open={activeLead !== null}
        onOpenChange={(open) => {
          if (!open) setActiveLead(null);
        }}
      />
    </>
  );
}
