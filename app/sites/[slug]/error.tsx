"use client";

import { useEffect } from "react";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary canônico das rotas `/sites/[slug]/*` (issue #202).
 *
 * **Client Component obrigatório** (Next 16 App Router requisito).
 *
 * Política V1:
 *   - Stack trace **proibido** em produção (somente `error.digest` opaco
 *     vai pra `data-error-digest` para correlação com observability).
 *   - `console.error` apenas em dev (`NODE_ENV !== 'production'`).
 *   - Retry button via `reset()` da boundary do Next.
 *   - Copy PT-BR com tom acolhedor.
 *
 * Tom: não acusar a loja PME — sempre falamos do "site". Preserva
 * confiança do prospect que abriu o link via WhatsApp.
 */
export default function SiteHomeError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[site:home:boundary]", error);
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
        Algo deu errado por aqui
      </h1>
      <p className="text-base text-foreground/70 md:text-lg">
        Não conseguimos carregar a página agora. Tente novamente em alguns
        segundos — se o problema persistir, fale com a equipe pelo WhatsApp.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-7 text-sm font-medium text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
