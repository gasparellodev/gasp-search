"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  Megaphone,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeadDetailDrawer } from "@/components/leads/lead-detail-drawer";
import { CAMPAIGN_MAX_LEADS } from "@/lib/validators/campaigns";
import {
  ENRICH_MAX_LEADS,
} from "@/lib/validators/search";
import {
  LEAD_PAGE_SIZE_OPTIONS,
  type LeadPageSize,
  type LeadSortableColumn,
} from "@/lib/validators/leads";
import type { LeadListItem, LeadTagSummary } from "@/lib/leads/list-leads";

interface LeadsTableProps {
  leads: LeadListItem[];
  totalCount: number;
  page: number;
  pageSize: LeadPageSize;
  totalPages: number;
  sortBy: LeadSortableColumn;
  sortDir: "asc" | "desc";
  tags: LeadTagSummary[];
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
  tags,
}: LeadsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeLead, setActiveLead] = useState<LeadListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enriching, setEnriching] = useState(false);
  const [, startTransition] = useTransition();

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage(checked: boolean) {
    setSelectedIds((current) => {
      if (!checked) {
        const next = new Set(current);
        for (const lead of leads) next.delete(lead.id);
        return next;
      }
      const next = new Set(current);
      for (const lead of leads) next.add(lead.id);
      return next;
    });
  }

  async function bulkEnrich() {
    if (selectedIds.size === 0) return;
    if (selectedIds.size > ENRICH_MAX_LEADS) {
      toast.error(
        `Limite de ${ENRICH_MAX_LEADS} leads por chamada. Reduza a seleção.`,
      );
      return;
    }
    const ids = [...selectedIds];
    setEnriching(true);
    toast.loading(`Enriquecendo ${ids.length} lead(s)…`, {
      id: "bulk-enrich",
    });
    try {
      const response = await fetch("/api/apify/enrich", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadIds: ids }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        enrichedCount?: number;
        failedIds?: string[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Falha no enrich");
      }
      toast.success(
        `Enriquecimento concluído: ${body.enrichedCount ?? 0} lead(s).`,
        { id: "bulk-enrich" },
      );
      setSelectedIds(new Set());
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao enriquecer leads",
        { id: "bulk-enrich" },
      );
    } finally {
      setEnriching(false);
    }
  }

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

  const allOnPageSelected =
    leads.length > 0 && leads.every((lead) => selectedIds.has(lead.id));
  const someOnPageSelected =
    !allOnPageSelected && leads.some((lead) => selectedIds.has(lead.id));

  const columns = useMemo<ColumnDef<LeadListItem>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <Checkbox
            aria-label="Selecionar todos"
            checked={
              allOnPageSelected
                ? true
                : someOnPageSelected
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(checked) => toggleAllOnPage(checked === true)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Selecionar lead ${row.original.name}`}
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={() => toggleSelected(row.original.id)}
            onClick={(event) => event.stopPropagation()}
          />
        ),
      },
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
          <span className="block max-w-56 truncate font-medium">
            {row.original.name}
          </span>
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
          <span className="text-muted-foreground block max-w-40 truncate">
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
          <span className="text-muted-foreground block max-w-36 truncate">
            {formatLocation(row.original)}
          </span>
        ),
      },
      {
        id: "contact",
        header: () => <span className="px-2">Contato</span>,
        cell: ({ row }) => (
          <span className="text-muted-foreground block max-w-52 truncate">
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
            <div className="flex max-w-48 flex-wrap gap-1">
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
    // Closures sobre sort, selectedIds e flags derivados — re-render por
    // dependência primitiva é suficiente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortBy, sortDir, selectedIds, allOnPageSelected, someOnPageSelected],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table retorna funções que não podem ser memoizadas com segurança; comportamento esperado.
  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (leads.length === 0) {
    return (
      <div className="border-border bg-card text-card-foreground flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed p-8 text-center sm:p-12">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
          <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-md">
            <Search className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-medium">Nenhum lead encontrado</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Faça uma nova busca para captar e qualificar seus primeiros
              leads.
            </p>
          </div>
          <Button asChild>
            <Link href="/search">Faça sua primeira busca</Link>
          </Button>
        </div>
      </div>
    );
  }

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(rangeStart + leads.length - 1, totalCount);

  return (
    <div
      data-testid="leads-table-shell"
      className="flex h-full min-h-0 flex-col gap-4"
    >
      {selectedIds.size > 0 ? (
        <div className="border-border bg-muted/40 flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2">
          <p className="text-sm">
            <strong>{selectedIds.size}</strong> selecionado(s)
            {selectedIds.size > ENRICH_MAX_LEADS ? (
              <span className="text-destructive ml-2">
                (enrich: máx {ENRICH_MAX_LEADS} por chamada)
              </span>
            ) : null}
            {selectedIds.size > CAMPAIGN_MAX_LEADS ? (
              <span className="text-destructive ml-2">
                (campanha: máx {CAMPAIGN_MAX_LEADS} leads)
              </span>
            ) : null}
          </p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Limpar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={enriching || selectedIds.size > ENRICH_MAX_LEADS}
              onClick={() => {
                void bulkEnrich();
              }}
            >
              {enriching ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 size-4" />
              )}
              Enriquecer selecionados
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={selectedIds.size > CAMPAIGN_MAX_LEADS}
              title={
                selectedIds.size > CAMPAIGN_MAX_LEADS
                  ? `Máximo ${CAMPAIGN_MAX_LEADS} leads por campanha`
                  : undefined
              }
              onClick={() => {
                const ids = [...selectedIds].join(",");
                router.push(`/campaigns/new?leads=${ids}`);
              }}
              data-testid="leads-toolbar-create-campaign"
            >
              <Megaphone className="mr-2 size-4" />
              Criar campanha
            </Button>
          </div>
        </div>
      ) : null}

      <div
        data-testid="leads-table-scroll"
        className="border-border min-h-0 max-w-full flex-1 overflow-auto rounded-lg border"
      >
        <Table className="min-w-[56rem]">
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

      <div
        data-testid="leads-table-pagination"
        className="text-muted-foreground flex min-w-0 shrink-0 flex-col gap-3 px-1 text-sm lg:flex-row lg:items-center lg:justify-between"
      >
        <p>
          Mostrando <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong>{" "}
          de <strong>{totalCount}</strong>
        </p>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex min-w-0 items-center gap-2">
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
          <span className="text-xs whitespace-nowrap">
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
        tags={tags}
      />
    </div>
  );
}
