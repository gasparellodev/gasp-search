"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pause } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createBrowserSupabase } from "@/lib/supabase/client";

type CampaignSummary = {
  id: string;
  name: string;
  status: "draft" | "running" | "completed" | "failed" | "cancelled";
  total_count: number;
  sent_count: number;
  failed_count: number;
  started_at: string | null;
  completed_at: string | null;
};

type Props = {
  initial: CampaignSummary;
};

export function CampaignProgress({ initial }: Props) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`campaigns:${initial.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "campaigns",
          filter: `id=eq.${initial.id}`,
        },
        (payload) => {
          // payload.new is the updated row
          setCampaign((prev) => ({ ...prev, ...(payload.new as CampaignSummary) }));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [initial.id]);

  const cancel = async () => {
    if (!confirm("Cancelar a campanha?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${initial.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Falha ao cancelar");
      }
      toast.success("Campanha cancelada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao cancelar");
    } finally {
      setBusy(false);
    }
  };

  const total = campaign.total_count;
  const done = campaign.sent_count + campaign.failed_count;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const running = campaign.status === "running";

  const statusLabels: Record<CampaignSummary["status"], string> = {
    draft: "Rascunho",
    running: "Em execução",
    completed: "Concluída",
    failed: "Falhou",
    cancelled: "Cancelada",
  };

  return (
    <Card data-testid="campaign-progress">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle>{campaign.name}</CardTitle>
          {running ? (
            <Button
              variant="outline"
              size="sm"
              onClick={cancel}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Pause className="size-4" />
              )}
              Cancelar
            </Button>
          ) : (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
              {statusLabels[campaign.status]}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>
              {done} de {total} processados
            </span>
            <span>{pct}%</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{campaign.sent_count} enviadas</span>
            <span className="text-destructive">
              {campaign.failed_count} falhas
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
