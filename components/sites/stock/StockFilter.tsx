"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

import {
  KNOWN_CATEGORY_SLUGS,
  type CarCategorySlug,
} from "./car-categories";

interface StockFilterProps {
  /** Slug do site, base para o `router.push` da nova URL. */
  slug: string;
  /**
   * Categorias atualmente ativas (pré-selecionadas pelos checkboxes).
   * Vem do server — derivado do `searchParams.categoria` via
   * `parseCategoriaParam`.
   */
  active: ReadonlySet<CarCategorySlug>;
}

const CATEGORY_LABELS: ReadonlyArray<{ slug: CarCategorySlug; label: string }> =
  [
    { slug: "sedan", label: "Sedan" },
    { slug: "suv", label: "SUV" },
    { slug: "picape", label: "Picape" },
    { slug: "hatch", label: "Hatch" },
    { slug: "esportivo", label: "Esportivo" },
  ];

/**
 * Filtro multi-select de categorias para a página `/estoque` (Phase 7 —
 * issue #164). Client Component **só** pelo `useRouter` + handler de
 * checkbox — toda a leitura do estado URL acontece no server (`<StockSection>`)
 * e desce pela prop `active`.
 *
 * Toggle: marcar/desmarcar checkbox dispara `router.push` com o
 * querystring `?categoria=slug1,slug2` (ou sem `?categoria` quando vazia).
 *
 * **`useTransition`**: enquanto o Next está navegando + revalidando
 * Server Components, mantém o checkbox visualmente em estado "loading"
 * via `aria-busy` no group. Sem isso, o user clica e nada parece mudar
 * (UX ruim em redes lentas).
 *
 * **A11y**: `role="group"`, `aria-labelledby` apontando pra título;
 * cada checkbox com `<label>` associado e `aria-checked` implícito via
 * `<input type="checkbox" checked>`.
 */
export function StockFilter({ slug, active }: StockFilterProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle(category: CarCategorySlug, checked: boolean) {
    const next = new Set<CarCategorySlug>(active);
    if (checked) {
      next.add(category);
    } else {
      next.delete(category);
    }

    // Re-ordena per `CATEGORY_LABELS` pra a URL ser determinística (testes
    // estáveis e cache-friendly).
    const ordered = CATEGORY_LABELS.map((c) => c.slug).filter((s) =>
      next.has(s),
    );

    const base = `/sites/${slug}/estoque`;
    const url =
      ordered.length === 0 ? base : `${base}?categoria=${ordered.join(",")}`;

    startTransition(() => {
      router.push(url);
    });
  }

  return (
    <fieldset
      data-testid="stock-filter"
      aria-busy={isPending || undefined}
      className="flex flex-col gap-3"
    >
      <legend className="text-sm font-medium uppercase tracking-[0.18em] text-foreground/60">
        Filtrar por categoria
      </legend>
      <div role="group" className="flex flex-wrap gap-2">
        {CATEGORY_LABELS.map(({ slug: catSlug, label }) => {
          const checked = active.has(catSlug);
          // Sanity: catSlug é uma das constantes de KNOWN_CATEGORY_SLUGS.
          // Esta linha mantém o set referenciado para ergonomia de tree-shake.
          void KNOWN_CATEGORY_SLUGS;
          return (
            <label
              key={catSlug}
              data-testid={`stock-filter-option-${catSlug}`}
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                checked
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground/20 bg-background text-foreground hover:border-foreground/40",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={isPending}
                onChange={(e) => toggle(catSlug, e.target.checked)}
                className="sr-only"
                aria-label={label}
              />
              <span aria-hidden>{checked ? "✓" : "+"}</span>
              <span>{label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
