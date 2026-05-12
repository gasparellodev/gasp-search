"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Clock3,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DashboardSummary,
  RecentSearch,
} from "@/lib/dashboard/types";
import { STAGE_LABEL } from "@/lib/leads/stage-presentation";
import type { LeadStage } from "@/lib/validators/leads";

const SEARCH_SOURCE_LABEL: Record<RecentSearch["source"], string> = {
  google_maps: "Google Maps",
  instagram: "Instagram",
  website_contact: "Contato web",
};

const SEARCH_STATUS_LABEL: Record<RecentSearch["status"], string> = {
  queued: "Na fila",
  running: "Rodando",
  succeeded: "Concluída",
  failed: "Falhou",
};

const SEARCH_STATUS_VARIANT: Record<
  RecentSearch["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  queued: "secondary",
  running: "outline",
  succeeded: "default",
  failed: "destructive",
};

const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatCount(value: number): string {
  return numberFormatter.format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" data-testid="dashboard-skeleton">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-36" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  description,
  value,
  icon: Icon,
}: Readonly<{
  title: string;
  description: string;
  value: number;
  icon: typeof Users;
}>) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Icon className="text-muted-foreground size-4" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <p className="sk-h2 tabular-nums">{formatCount(value)}</p>
      </CardContent>
    </Card>
  );
}

function EmptyDashboardState() {
  return (
    <Card className="border-dashed">
      <CardHeader className="items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-md">
            <Search className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <CardTitle>Base ainda vazia</CardTitle>
            <CardDescription>
              Comece uma busca para preencher o dashboard, a tabela de leads e
              o pipeline.
            </CardDescription>
          </div>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/search">Faça sua primeira busca</Link>
        </Button>
      </CardHeader>
    </Card>
  );
}

function RecentSearchRow({ search }: Readonly<{ search: RecentSearch }>) {
  return (
    <li className="border-border flex flex-col gap-3 border-b py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{SEARCH_SOURCE_LABEL[search.source]}</p>
          <Badge variant={SEARCH_STATUS_VARIANT[search.status]}>
            {SEARCH_STATUS_LABEL[search.status]}
          </Badge>
        </div>
        <p className="text-muted-foreground break-words text-sm">
          {formatDate(search.createdAt)}
          {search.errorMessage ? ` · ${search.errorMessage}` : ""}
        </p>
      </div>
      <div className="text-sm font-medium whitespace-nowrap tabular-nums">
        {formatCount(search.resultsCount)} leads
      </div>
    </li>
  );
}

export function DashboardView() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Falha ao carregar dashboard");
        }
        const body = (await response.json()) as DashboardSummary;
        if (active) {
          setSummary(body);
          setError(null);
        }
      } catch {
        if (active) {
          setError("Falha ao carregar dashboard. Tente novamente.");
        }
      }
    }

    void loadDashboard();
    window.addEventListener("focus", loadDashboard);

    return () => {
      active = false;
      window.removeEventListener("focus", loadDashboard);
    };
  }, []);

  if (!summary && !error) {
    return <DashboardSkeleton />;
  }

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dashboard indisponível</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const activePipeline =
    summary.leadsByStage.contacted +
    summary.leadsByStage.in_conversation +
    summary.leadsByStage.qualified;
  const isEmptyDashboard =
    summary.totalLeads === 0 && summary.recentSearches.length === 0;

  return (
    <div className="space-y-6">
      {isEmptyDashboard ? <EmptyDashboardState /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total de leads"
          description="Todos os estágios"
          value={summary.totalLeads}
          icon={Users}
        />
        <MetricCard
          title="Novos (7 dias)"
          description="Captados na última semana"
          value={summary.newLeadsLast7Days}
          icon={TrendingUp}
        />
        <MetricCard
          title="Pipeline ativo"
          description="Contatados, conversa e qualificados"
          value={activePipeline}
          icon={Activity}
        />
        <MetricCard
          title="Últimas buscas"
          description="Execuções recentes"
          value={summary.recentSearches.length}
          icon={Search}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(STAGE_LABEL).map(([stage, label]) => (
          <MetricCard
            key={stage}
            title={label}
            description="Leads neste estágio"
            value={summary.leadsByStage[stage as LeadStage]}
            icon={Clock3}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas buscas</CardTitle>
          <CardDescription>
            As 5 execuções mais recentes com status e total importado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summary.recentSearches.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhuma busca executada ainda.
            </p>
          ) : (
            <ul>
              {summary.recentSearches.map((search) => (
                <RecentSearchRow key={search.id} search={search} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
