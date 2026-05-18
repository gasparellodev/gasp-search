"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IaraMetricsCards } from "@/components/iara/iara-metrics-cards";
import { IaraReviewTable } from "@/components/iara/iara-review-table";
import {
  type IaraApprovalStatus,
  type IaraConversationListItem,
  type IaraHandoffPriority,
} from "@/components/iara/types";

interface IaraReviewClientProps {
  initialItems: IaraConversationListItem[];
}

const APPROVAL_OPTIONS: { value: "all" | IaraApprovalStatus; label: string }[] =
  [
    { value: "all", label: "Todas" },
    { value: "pending", label: "Aguardando revisão" },
    { value: "approved", label: "Aprovadas" },
    { value: "rejected", label: "Reprovadas" },
  ];

const HANDOFF_OPTIONS: {
  value: "all" | IaraHandoffPriority | "none";
  label: string;
}[] = [
  { value: "all", label: "Todos" },
  { value: "P0", label: "P0" },
  { value: "P1", label: "P1" },
  { value: "P2", label: "P2" },
  { value: "P3", label: "P3" },
  { value: "none", label: "Sem handoff" },
];

function computeMetrics(items: IaraConversationListItem[]) {
  const total = items.length;
  if (total === 0) {
    return { total: 0, pctP0: 0, pctApproved: 0, pctRejected: 0 };
  }
  const p0 = items.filter((i) => i.latestHandoffPriority === "P0").length;
  const approved = items.filter((i) => i.approvalStatus === "approved").length;
  const rejected = items.filter((i) => i.approvalStatus === "rejected").length;
  return {
    total,
    pctP0: (p0 / total) * 100,
    pctApproved: (approved / total) * 100,
    pctRejected: (rejected / total) * 100,
  };
}

export function IaraReviewClient({ initialItems }: IaraReviewClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<
    "all" | IaraApprovalStatus
  >(
    (searchParams.get("approvalStatus") as IaraApprovalStatus | null) ?? "all",
  );
  const [handoffFilter, setHandoffFilter] = useState<
    "all" | IaraHandoffPriority | "none"
  >(
    (searchParams.get("handoffPriority") as IaraHandoffPriority | null) ??
      "all",
  );
  const [, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);

  // Sync filters → URL → re-fetch.
  useEffect(() => {
    const params = new URLSearchParams();
    if (approvalFilter !== "all")
      params.set("approvalStatus", approvalFilter);
    if (handoffFilter !== "all" && handoffFilter !== "none")
      params.set("handoffPriority", handoffFilter);
    const next = params.toString();
    startTransition(() => {
      router.replace(`?${next}`, { scroll: false });
    });

    let cancelled = false;
    (async () => {
      setRefreshing(true);
      try {
        const url = new URL(
          "/api/iara/sandbox/conversations",
          window.location.origin,
        );
        if (approvalFilter !== "all") {
          url.searchParams.set("approvalStatus", approvalFilter);
        }
        if (handoffFilter !== "all" && handoffFilter !== "none") {
          url.searchParams.set("handoffPriority", handoffFilter);
        }
        const res = await fetch(url.toString());
        if (!res.ok) return;
        const body = (await res.json()) as {
          items: IaraConversationListItem[];
        };
        if (!cancelled) setItems(body.items);
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `router` é estável em Next.js real, mas o mock cria nova ref a cada
    // render — manter o effect dependente só dos filtros evita loop infinito
    // em testes e re-fetch redundante em produção.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalFilter, handoffFilter]);

  const visibleItems = useMemo(() => {
    let list = items;
    if (handoffFilter === "none") {
      list = list.filter((i) => i.latestHandoffPriority === null);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((i) =>
        `${i.leadBusinessName} ${i.leadCity ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    return list;
  }, [items, handoffFilter, query]);

  const metrics = useMemo(() => computeMetrics(items), [items]);

  function handleUpdated(id: string, status: IaraApprovalStatus) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, approvalStatus: status } : it)),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <IaraMetricsCards snapshot={metrics} />

      <div className="bg-muted/40 grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="iara-filter-approval">Aprovação</Label>
          <Select
            value={approvalFilter}
            onValueChange={(v) =>
              setApprovalFilter(v as typeof approvalFilter)
            }
          >
            <SelectTrigger id="iara-filter-approval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPROVAL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="iara-filter-handoff">Handoff</Label>
          <Select
            value={handoffFilter}
            onValueChange={(v) =>
              setHandoffFilter(v as typeof handoffFilter)
            }
          >
            <SelectTrigger id="iara-filter-handoff">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HANDOFF_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="iara-filter-query">Buscar</Label>
          <div className="relative">
            <Search
              className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              id="iara-filter-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Lead ou cidade"
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {refreshing ? (
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          Atualizando...
        </p>
      ) : null}

      <IaraReviewTable items={visibleItems} onUpdated={handleUpdated} />
    </div>
  );
}

export default IaraReviewClient;
