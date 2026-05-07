"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type SearchProgressStatus = "running" | "succeeded" | "failed";

type SearchProgressProps = Readonly<{
  actorName?: string;
  initialElapsedSeconds?: number;
  status?: SearchProgressStatus;
}>;

function getStatusText(actorName: string, status: SearchProgressStatus) {
  if (status === "succeeded") return `${actorName} concluído`;
  if (status === "failed") return `${actorName} falhou`;
  return `Executando ${actorName}`;
}

export function SearchProgress({
  actorName = "Google Maps",
  initialElapsedSeconds = 0,
  status = "running",
}: SearchProgressProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsedSeconds);
  const isRunning = status === "running";

  useEffect(() => {
    if (!isRunning) return;

    const intervalId = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, [isRunning]);

  const statusText = getStatusText(actorName, status);

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
      {isRunning ? (
        <Loader2 className="text-primary size-4 animate-spin" />
      ) : null}
      <span>{statusText}</span>
      <span className="text-muted-foreground tabular-nums">
        {elapsedSeconds}s
      </span>
    </div>
  );
}
