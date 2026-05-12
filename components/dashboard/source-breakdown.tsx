"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SourceBreakdownItem } from "@/lib/dashboard/types";
import type { LeadSource } from "@/lib/validators/leads";

const SOURCE_LABEL: Record<LeadSource, string> = {
  google_maps: "Google Maps",
  instagram: "Instagram",
  website_contact: "Contato web",
};

const SOURCE_BAR_CLASS: Record<LeadSource, string> = {
  google_maps: "bg-sky-500 dark:bg-sky-400",
  instagram: "bg-fuchsia-500 dark:bg-fuchsia-400",
  website_contact: "bg-emerald-500 dark:bg-emerald-400",
};

const numberFormatter = new Intl.NumberFormat("pt-BR");
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
});

function SourceBreakdownSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Atribuição por fonte</CardTitle>
        <CardDescription>
          Volume e taxa de conversão por canal de captação.
        </CardDescription>
      </CardHeader>
      <CardContent
        className="space-y-4"
        data-testid="source-breakdown-skeleton"
      >
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <p className="text-muted-foreground text-sm">
      Nenhum lead capturado ainda. As fontes vão aparecer aqui assim que a
      primeira busca importar resultados.
    </p>
  );
}

function SourceBar({
  item,
  maxTotal,
}: Readonly<{ item: SourceBreakdownItem; maxTotal: number }>) {
  const widthPct = maxTotal > 0 ? Math.round((item.total / maxTotal) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{SOURCE_LABEL[item.source]}</span>
        <div className="text-muted-foreground flex items-center gap-3 tabular-nums">
          <span>{numberFormatter.format(item.total)} leads</span>
          <span>{numberFormatter.format(item.closedWon)} ganhos</span>
          <span className="text-foreground font-medium">
            {percentFormatter.format(item.conversionRate)} conversão
          </span>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label={`${SOURCE_LABEL[item.source]}: ${item.total} leads`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={widthPct}
        className="bg-muted relative h-2 w-full overflow-hidden rounded-full"
      >
        <div
          className={`h-full rounded-full transition-[width] ${SOURCE_BAR_CLASS[item.source]}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

export function SourceBreakdown({
  data,
}: Readonly<{ data: SourceBreakdownItem[] | null }>) {
  if (data === null) {
    return <SourceBreakdownSkeleton />;
  }

  const maxTotal = data.reduce((acc, item) => Math.max(acc, item.total), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atribuição por fonte</CardTitle>
        <CardDescription>
          Volume e taxa de conversão por canal de captação.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          data.map((item) => (
            <SourceBar key={item.source} item={item} maxTotal={maxTotal} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
