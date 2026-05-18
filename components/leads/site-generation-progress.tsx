"use client";

/**
 * `<SiteGenerationProgress />` — overlay com 3 estágios animados que
 * tranquiliza o operador durante os ~30-60s do `generateLeadSite` (sprint
 * A2 onsite flow).
 *
 * Sem hook em `next/cache` ou Server-Sent Events: o pipeline é síncrono
 * dentro da Server Action, então não temos eventos reais de progresso.
 * A solução V1 é cosmética — `setInterval` avança o estágio a cada
 * `STAGE_DURATION_MS`. **Não revela** o status real; apenas indica que o
 * trabalho está vivo, evitando que o operador refresque a página
 * (o que cancela a request server-side e deixa um draft preso).
 *
 * Se a action retornar erro, o parent fecha o overlay e mostra toast +
 * banner de erro como antes — não interferimos no recovery flow do A3.
 *
 * **TODO V2:** quando migrarmos pra BullMQ + polling, ler o estágio real
 * de uma coluna `generation_progress` ou via Supabase Realtime e mostrar
 * tempo restante estimado. Por enquanto, fake progress + cap de 90s no
 * `maxDuration` da rota (issue #217).
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const STAGE_DURATION_MS = 12_000;

const STAGES = [
  {
    label: "Extraindo identidade da marca",
    hint: "Logo, cores e fotos do Instagram/Google Maps",
  },
  {
    label: "Gerando textos com IA",
    hint: "Slogan, sobre, descrições de carros — pode levar até 30s",
  },
  {
    label: "Compondo o site",
    hint: "Aplicando layout e validando antes de publicar",
  },
] as const;

interface SiteGenerationProgressProps {
  /** Quando `true`, o overlay aparece e a animação começa. Pai controla
   *  o ciclo de vida — `false` esconde via early return.
   *
   *  **Pra reset entre execuções (ex: retry após erro):** o pai deve
   *  trocar o `key` do componente quando `active` flipa false→true.
   *  Sem `key`, o estado interno persiste no último estágio — aceitável
   *  enquanto o indicador é puramente cosmético. */
  active: boolean;
  /** Override pra testes — pula timers e fixa o estágio. */
  initialStage?: number;
}

export function SiteGenerationProgress({
  active,
  initialStage,
}: SiteGenerationProgressProps) {
  // Estado inicializa uma única vez (constructor da instância). Reset
  // entre execuções fica a cargo do pai via `key`.
  const [stage, setStage] = useState(initialStage ?? 0);

  useEffect(() => {
    // Override pra testes: stage fixo, sem timers.
    if (initialStage !== undefined) return;
    // Quando inativo, não roda interval — mas também não toca em state
    // (evita cascading render dentro do effect body — react-hooks lint).
    if (!active) return;

    const interval = setInterval(() => {
      setStage((prev) => {
        if (prev >= STAGES.length - 1) return prev;
        return prev + 1;
      });
    }, STAGE_DURATION_MS);
    return () => clearInterval(interval);
  }, [active, initialStage]);

  const current = useMemo(
    () => STAGES[Math.min(stage, STAGES.length - 1)] ?? STAGES[0],
    [stage],
  );

  if (!active) return null;

  return (
    <div
      className="border-primary/30 bg-primary/5 mt-3 rounded-md border px-4 py-3"
      role="status"
      aria-live="polite"
      data-testid="site-generation-progress"
    >
      <div className="flex items-center gap-3">
        <Loader2
          className="text-primary size-5 animate-spin shrink-0"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p
            className="text-foreground text-sm font-medium"
            data-testid="site-generation-stage-label"
          >
            {current?.label ?? STAGES[0]!.label}
          </p>
          <p className="text-muted-foreground text-xs">{current?.hint}</p>
        </div>
      </div>
      <div
        className="bg-muted mt-3 h-1.5 w-full overflow-hidden rounded-full"
        aria-hidden="true"
      >
        {STAGES.map((_, idx) => (
          <span
            key={idx}
            className={cn(
              "inline-block h-full transition-all duration-500",
              idx <= stage ? "bg-primary" : "bg-transparent",
            )}
            style={{ width: `${100 / STAGES.length}%` }}
          />
        ))}
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Não feche a aba — a geração leva entre 30 e 90 segundos.
      </p>
    </div>
  );
}

// Export pra testes / introspecção.
export const __INTERNAL_STAGES = STAGES;
export const __INTERNAL_STAGE_DURATION_MS = STAGE_DURATION_MS;
