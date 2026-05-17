"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { sanitizeHex } from "@/lib/sites/sanitize";
import { serializeQuickSearch } from "@/lib/sites/stock-search-params";
import { cn } from "@/lib/utils";

interface HomeQuickSearchBarProps {
  /** Slug do site — usado pra construir o destino `/sites/<slug>/estoque`. */
  slug: string;
  /** Cor primária do site (hex hash6, sanitizada in-component pra defesa em profundidade). */
  primary_color: string;
  /** Cor de texto sobre primário (hex hash6). */
  text_on_primary: string;
}

/**
 * Barra de busca rápida do Hero da Home — versão cinematic dark
 * (Phase 7 / hero redesign).
 *
 * Client Component (3 inputs controlados + submit). Compõe
 * `/estoque?m=...&model=...&p=...` via `serializeQuickSearch` —
 * fonte única acordada com a página `/estoque` (#224 / E1).
 *
 * Visual: glass dark unificado, 3 campos com divider sutil, botão
 * primary pill com ícone. Mobile colapsa em stack vertical
 * preservando hierarquia.
 *
 * A11y: cada input tem `<label htmlFor>` (sr-only desktop, visível
 * mobile pra dar pista no stack), placeholder explícito. Botão usa
 * `primary_color` do lead com defesa em profundidade via `sanitizeHex`.
 */
export function HomeQuickSearchBar({
  slug,
  primary_color,
  text_on_primary,
}: HomeQuickSearchBarProps) {
  const router = useRouter();
  const idBase = useId();
  const brandId = `${idBase}-brand`;
  const modelId = `${idBase}-model`;
  const priceId = `${idBase}-price`;
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

  const fieldClass = cn(
    "h-12 w-full bg-transparent px-4 text-sm text-white",
    "placeholder:text-white/40",
    "focus-visible:outline-none focus-visible:bg-white/[0.06]",
    "md:h-14",
  );

  const labelClass = cn(
    "px-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55",
    "md:sr-only",
  );

  return (
    <form
      data-testid="home-quick-search-bar"
      onSubmit={handleSubmit}
      className={cn(
        "w-full rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-md",
        "shadow-[0_10px_40px_-15px_rgba(0,0,0,0.6)]",
        "p-3 md:flex md:items-stretch md:gap-0 md:p-2",
      )}
    >
      {/* Brand */}
      <div className="flex flex-col md:flex-1">
        <label htmlFor={brandId} className={labelClass}>
          Marca
        </label>
        <input
          id={brandId}
          name="brand"
          type="text"
          autoComplete="off"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Toyota, Honda, Fiat…"
          className={fieldClass}
        />
      </div>

      <div
        aria-hidden="true"
        className="my-1 h-px bg-white/10 md:my-0 md:h-auto md:w-px"
      />

      {/* Model */}
      <div className="flex flex-col md:flex-1">
        <label htmlFor={modelId} className={labelClass}>
          Modelo
        </label>
        <input
          id={modelId}
          name="model"
          type="text"
          autoComplete="off"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Corolla, Civic, HB20…"
          className={fieldClass}
        />
      </div>

      <div
        aria-hidden="true"
        className="my-1 h-px bg-white/10 md:my-0 md:h-auto md:w-px"
      />

      {/* Price max */}
      <div className="flex flex-col md:flex-1">
        <label htmlFor={priceId} className={labelClass}>
          Preço máx. (R$)
        </label>
        <input
          id={priceId}
          name="priceMax"
          type="number"
          inputMode="numeric"
          min={0}
          step={1000}
          value={priceMax}
          onChange={(e) => setPriceMax(e.target.value)}
          placeholder="120.000"
          className={fieldClass}
        />
      </div>

      <button
        type="submit"
        style={{
          backgroundColor: safePrimary,
          color: safeTextOnPrimary,
        }}
        className={cn(
          "mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-7 text-sm font-semibold transition",
          "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
          "md:ml-1 md:mt-0 md:h-14 md:w-auto md:shrink-0 md:px-7",
        )}
      >
        <Search aria-hidden className="size-4" />
        Buscar
      </button>
    </form>
  );
}
