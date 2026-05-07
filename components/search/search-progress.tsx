"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type SearchProgressStatus = "queued" | "running" | "succeeded" | "failed";

type SearchProgressProps = Readonly<{
  actorName?: string;
  initialElapsedSeconds?: number;
  status?: SearchProgressStatus;
  resultsCount?: number;
}>;

function getStatusText(
  actorName: string,
  status: SearchProgressStatus,
  resultsCount: number,
) {
  if (status === "succeeded")
    return `${actorName} concluído — ${resultsCount} leads`;
  if (status === "failed") return `${actorName} falhou`;
  if (status === "queued") return `Aguardando início — ${actorName}`;
  return `Executando ${actorName}`;
}

export function SearchProgress({
  actorName = "Google Maps",
  initialElapsedSeconds = 0,
  status = "running",
  resultsCount = 0,
}: SearchProgressProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsedSeconds);
  const isActive = status === "running" || status === "queued";

  useEffect(() => {
    if (!isActive) return;

    const intervalId = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, [isActive]);

  const statusText = getStatusText(actorName, status, resultsCount);

  return (
    <div
      className="border-border bg-muted/40 flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
      role="status"
      aria-live="polite"
    >
      {status === "succeeded" ? (
        <CheckCircle2 className="text-primary size-4" />
      ) : null}
      {status === "failed" ? (
        <XCircle className="text-destructive size-4" />
      ) : null}
      {isActive ? (
        <Loader2 className="text-primary size-4 animate-spin" />
      ) : null}
      <span>{statusText}</span>
      <span className="text-muted-foreground tabular-nums">
        {elapsedSeconds}s
      </span>
    </div>
  );
}
