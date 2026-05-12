"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { STAGE_LABEL } from "@/lib/leads/stage-presentation";
import type { FunnelStage, FunnelStageStat } from "@/lib/dashboard/types";

const STAGE_BAR_CLASS: Record<FunnelStage, string> = {
  new: "bg-sky-500 dark:bg-sky-400",
  contacted: "bg-amber-500 dark:bg-amber-400",
  in_conversation: "bg-violet-500 dark:bg-violet-400",
  qualified: "bg-emerald-500 dark:bg-emerald-400",
  closed_won: "bg-emerald-700 dark:bg-emerald-500",
};

const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatDropRate(value: number): string {
  const pct = Math.round(value * 100);
  if (pct > 0) return `-${pct}%`;
  if (pct < 0) return `+${Math.abs(pct)}%`;
  return "0%";
}

function FunnelSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de conversão</CardTitle>
        <CardDescription>
          Volume por estágio e drop rate entre etapas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4" data-testid="funnel-skeleton">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FunnelBar({
  item,
  maxCount,
}: Readonly<{ item: FunnelStageStat; maxCount: number }>) {
  const widthPct =
    maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{STAGE_LABEL[item.stage]}</span>
        <div className="text-muted-foreground flex items-center gap-3 tabular-nums">
          <span className="text-foreground font-medium">
            {numberFormatter.format(item.count)}
          </span>
          {item.dropRate !== null ? (
            <span
              className={
                item.dropRate > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : item.dropRate < 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
              }
            >
              {formatDropRate(item.dropRate)}
            </span>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          )}
        </div>
      </div>
      <div
        role="progressbar"
        aria-label={`${STAGE_LABEL[item.stage]}: ${item.count} leads`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={widthPct}
        className="bg-muted relative h-2 w-full overflow-hidden rounded-full"
      >
        <div
          className={`h-full rounded-full transition-[width] ${STAGE_BAR_CLASS[item.stage]}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

export function Funnel({
  data,
}: Readonly<{ data: FunnelStageStat[] | null }>) {
  if (data === null) {
    return <FunnelSkeleton />;
  }

  const maxCount = data.reduce((acc, item) => Math.max(acc, item.count), 0);
  const isEmpty = maxCount === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de conversão</CardTitle>
        <CardDescription>
          Volume por estágio e drop rate entre etapas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEmpty ? (
          <p className="text-muted-foreground text-sm">
            Sem leads no funil ainda. Importe leads ou avance estágios no
            pipeline para ver as taxas de conversão.
          </p>
        ) : (
          data.map((item) => (
            <FunnelBar key={item.stage} item={item} maxCount={maxCount} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
