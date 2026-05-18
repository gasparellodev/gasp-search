"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface IaraMetricsSnapshot {
  total: number;
  pctP0: number;
  pctApproved: number;
  pctRejected: number;
}

interface IaraMetricsCardsProps {
  snapshot: IaraMetricsSnapshot;
}

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

export function IaraMetricsCards({ snapshot }: IaraMetricsCardsProps) {
  const cards = [
    {
      label: "Conversas totais",
      value: snapshot.total.toLocaleString("pt-BR"),
      tone: "default" as const,
    },
    {
      label: "Com handoff P0",
      value: formatPct(snapshot.pctP0),
      tone: "danger" as const,
    },
    {
      label: "Aprovadas",
      value: formatPct(snapshot.pctApproved),
      tone: "success" as const,
    },
    {
      label: "Reprovadas",
      value: formatPct(snapshot.pctRejected),
      tone: "warn" as const,
    },
  ];

  return (
    <div
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
      role="list"
      aria-label="Métricas de revisão da Iara"
    >
      {cards.map((c) => (
        <Card key={c.label} role="listitem">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              {c.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {c.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default IaraMetricsCards;
