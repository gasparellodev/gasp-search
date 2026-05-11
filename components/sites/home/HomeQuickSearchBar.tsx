"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { sanitizeHex } from "@/lib/sites/sanitize";
import { serializeQuickSearch } from "@/lib/sites/stock-search-params";

interface HomeQuickSearchBarProps {
  /** Slug do site — usado pra construir o destino `/sites/<slug>/estoque`. */
  slug: string;
  /** Cor primária do site (hex hash6, sanitizada in-component pra defesa em profundidade). */
  primary_color: string;
  /** Cor de texto sobre primário (hex hash6). */
  text_on_primary: string;
}

/**
 * Barra de busca rápida do Hero da Home (Phase 7 / Sprint 4 / #H1 — issue #221).
 *
 * Client Component (3 inputs controlados + submit). Compõe `/estoque?m=...&model=...&p=...`
 * via `serializeQuickSearch` de `lib/sites/stock-search-params.ts` —
 * fonte única acordada com a página `/estoque` (#224 / E1). Sem JS-only
 * surprises: usa um `<form>` real com `onSubmit` controlado, e roteia
 * via `useRouter().push()` (mesma origem) pra preservar SPA navigation.
 *
 * **A11y**: cada input tem `<label htmlFor>` associado e contraste WCAG
 * AA — testado via jest-axe. Botão usa `primary_color` do lead com
 * defesa em profundidade via `sanitizeHex`.
 */
export function HomeQuickSearchBar({
  slug,
  primary_color,
  text_on_primary,
}: HomeQuickSearchBarProps) {
  const router = useRouter();
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const safePrimary = sanitizeHex(primary_color);
  const safeTextOnPrimary = sanitizeHex(text_on_primary);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedPriceMax = priceMax.trim() === "" ? null : Number(priceMax);
    const qs = serializeQuickSearch({
      brand,
      model,
      priceMax: Number.isFinite(parsedPriceMax) ? parsedPriceMax : null,
    });
    const destination = qs
      ? `/sites/${slug}/estoque?${qs}`
      : `/sites/${slug}/estoque`;
    router.push(destination);
  };

  return (
    <form
      data-testid="home-quick-search-bar"
      onSubmit={handleSubmit}
      className="grid w-full grid-cols-1 gap-3 rounded-2xl bg-background/90 p-4 shadow-sm ring-1 ring-foreground/10 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end md:rounded-full md:bg-background md:p-3 md:pl-5 md:shadow-md"
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="quick-search-brand"
          className="text-xs font-medium uppercase tracking-wide text-foreground/70"
        >
          Marca
        </label>
        <input
          id="quick-search-brand"
          name="brand"
          type="text"
          autoComplete="off"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Toyota, Honda, Fiat…"
          className="h-10 w-full rounded-md border border-foreground/15 bg-background px-3 text-sm text-foreground placeholder:text-foreground/40 focus-visible:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 md:h-9 md:border-transparent md:bg-transparent md:px-2"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="quick-search-model"
          className="text-xs font-medium uppercase tracking-wide text-foreground/70"
        >
          Modelo
        </label>
        <input
          id="quick-search-model"
          name="model"
          type="text"
          autoComplete="off"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Corolla, Civic, HB20…"
          className="h-10 w-full rounded-md border border-foreground/15 bg-background px-3 text-sm text-foreground placeholder:text-foreground/40 focus-visible:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 md:h-9 md:border-transparent md:bg-transparent md:px-2"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="quick-search-price"
          className="text-xs font-medium uppercase tracking-wide text-foreground/70"
        >
          Preço máx. (R$)
        </label>
        <input
          id="quick-search-price"
          name="priceMax"
          type="number"
          inputMode="numeric"
          min={0}
          step={1000}
          value={priceMax}
          onChange={(e) => setPriceMax(e.target.value)}
          placeholder="120000"
          className="h-10 w-full rounded-md border border-foreground/15 bg-background px-3 text-sm text-foreground placeholder:text-foreground/40 focus-visible:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 md:h-9 md:border-transparent md:bg-transparent md:px-2"
        />
      </div>

      <button
        type="submit"
        style={{
          backgroundColor: safePrimary,
          color: safeTextOnPrimary,
        }}
        className="inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold tracking-wide transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 md:h-11 md:px-6"
      >
        Buscar
      </button>
    </form>
  );
}
