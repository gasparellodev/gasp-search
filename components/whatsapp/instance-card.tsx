"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  QrCode,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createBrowserSupabase } from "@/lib/supabase/client";

type InstanceStatus =
  | "disconnected"
  | "qr_pending"
  | "connecting"
  | "connected"
  | "error";

type InstanceState = {
  status: InstanceStatus;
  phoneNumber: string | null;
  lastSeenAt: string | null;
};

type QrState = {
  qrcode: string | null;
  pairingCode: string | null;
  status: InstanceStatus;
};

const QR_POLL_INTERVAL_MS = 2000;

async function fetchInstance(): Promise<InstanceState> {
  const res = await fetch("/api/whatsapp/instance", { cache: "no-store" });
  if (!res.ok) throw new Error("instance fetch failed");
  return (await res.json()) as InstanceState;
}

async function fetchQR(): Promise<QrState> {
  const res = await fetch("/api/whatsapp/instance/qr", { cache: "no-store" });
  if (!res.ok) throw new Error("qr fetch failed");
  return (await res.json()) as QrState;
}

async function postCreate() {
  const res = await fetch("/api/whatsapp/instance", { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Falha ao conectar");
  }
  return (await res.json()) as {
    status: InstanceStatus;
    qrcode: string | null;
  };
}

async function postDelete() {
  const res = await fetch("/api/whatsapp/instance", { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Falha ao desconectar");
  }
}

function StatusBadge({ status }: { status: InstanceStatus }) {
  const variants: Record<InstanceStatus, { label: string; className: string }> = {
    disconnected: {
      label: "Desconectado",
      className: "bg-muted text-muted-foreground",
    },
    qr_pending: {
      label: "Aguardando leitura",
      className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    },
    connecting: {
      label: "Conectando",
      className: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    },
    connected: {
      label: "Conectado",
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    error: {
      label: "Erro",
      className: "bg-destructive/15 text-destructive",
    },
  };
  const variant = variants[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variant.className}`}
      data-testid="whatsapp-status"
    >
      {variant.label}
    </span>
  );
}

export function InstanceCard() {
  const [state, setState] = useState<InstanceState | null>(null);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling do QR enquanto qr_pending. Limpamos QR no cleanup, fora do
  // body do effect, pra não ferir a regra react-hooks/set-state-in-effect.
  const status = state?.status;
  useEffect(() => {
    if (status !== "qr_pending") {
      return () => {
        // sem trabalho — early return acima já evitou agendar polling
      };
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const qr = await fetchQR();
        if (!cancelled && qr.qrcode) setQrcode(qr.qrcode);
      } catch {
        // ignora — toast só em ações do usuário
      }
    };
    void poll();
    pollRef.current = setInterval(poll, QR_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      // setState no cleanup é permitido pela regra (não cascata sync no body).
      setQrcode(null);
    };
  }, [status]);

  // Realtime: load inicial + subscribe a UPDATE em whatsapp_instances.
  // Definimos reload INSIDE o effect (estilo dashboard-view) para que o
  // setState fique dentro de uma callback async, não no body do effect.
  useEffect(() => {
    let active = true;
    const reload = async () => {
      try {
        const next = await fetchInstance();
        if (active) setState(next);
      } catch {
        // mantém estado anterior
      }
    };
    void reload();
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel("whatsapp_instances:self")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_instances",
        },
        () => {
          void reload();
        },
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const result = await postCreate();
      setQrcode(result.qrcode);
      setState((prev) => ({
        status: result.status,
        phoneNumber: prev?.phoneNumber ?? null,
        lastSeenAt: prev?.lastSeenAt ?? null,
      }));
      toast.success("Escaneie o QR Code no celular");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao conectar");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Tem certeza que deseja desconectar o WhatsApp?")) return;
    setBusy(true);
    try {
      await postDelete();
      setQrcode(null);
      setState({ status: "disconnected", phoneNumber: null, lastSeenAt: null });
      toast.success("WhatsApp desconectado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao desconectar");
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="whatsapp-instance-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="size-5" /> WhatsApp
          </CardTitle>
          <CardDescription>
            Conecte um número WhatsApp para enviar e receber mensagens dentro do
            gasp-search.
          </CardDescription>
        </div>
        <StatusBadge status={state.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {state.status === "disconnected" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Nenhum número conectado.
            </p>
            <Button onClick={handleConnect} disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <QrCode className="size-4" />
              )}
              Conectar WhatsApp
            </Button>
          </div>
        )}
        {state.status === "qr_pending" && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Aguardando você ler o QR Code no celular...
            </p>
            {qrcode ? (
              <div
                className="bg-card p-4 rounded-lg w-fit"
                data-testid="whatsapp-qrcode-wrap"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrcode}
                  alt="QR Code do WhatsApp"
                  className="size-64 rounded-md"
                  data-testid="whatsapp-qrcode"
                />
              </div>
            ) : (
              <Skeleton className="size-64 rounded-md" />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={busy}
            >
              Cancelar
            </Button>
          </div>
        )}
        {state.status === "connecting" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Conectando...
          </p>
        )}
        {state.status === "connected" && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              Conectado{state.phoneNumber ? ` como ${state.phoneNumber}` : ""}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={busy}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Desconectar
            </Button>
          </div>
        )}
        {state.status === "error" && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <TriangleAlert className="size-4" />
            Não foi possível obter o estado da instância.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
