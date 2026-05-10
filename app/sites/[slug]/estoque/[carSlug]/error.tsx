"use client";

import { useEffect } from "react";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CarDetailError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[site:car-detail:boundary]", error);
    }
  }, [error]);

  return (
    <div
      role="alert"
      data-testid="site-error-boundary"
      data-error-digest={error.digest ?? "unknown"}
      className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-6 px-6 py-16 text-center"
    >
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-foreground/60">
        Ops
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        Não conseguimos carregar esse veículo
      </h1>
      <p className="text-base text-foreground/70 md:text-lg">
        Tente novamente em alguns segundos.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-7 text-sm font-medium text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
      >
        Tentar novamente
      </button>
    </div>
  );
}
