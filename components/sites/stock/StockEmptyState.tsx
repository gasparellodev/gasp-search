"use client";

import Link from "next/link";

interface StockEmptyStateProps {
  slug: string;
  onClear: () => void;
}

export function StockEmptyState({ slug, onClear }: StockEmptyStateProps) {
  return (
    <div
      data-testid="stock-empty"
      className="mx-auto flex max-w-md flex-col items-center gap-6 px-6 py-20 text-center"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 160 120"
        className="h-28 w-36 text-[var(--auto-muted-foreground,#737373)]"
      >
        <rect
          x="24"
          y="50"
          width="112"
          height="34"
          rx="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          d="M44 50l14-18h44l14 18"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        <circle cx="54" cy="88" r="10" fill="currentColor" opacity="0.18" />
        <circle cx="106" cy="88" r="10" fill="currentColor" opacity="0.18" />
        <path
          d="M18 30h22M122 30h20M62 100h36"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="4"
          opacity="0.45"
        />
      </svg>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-normal text-foreground">
          Nenhum carro encontrado
        </h2>
        <p className="text-base text-foreground/70 md:text-lg">
          Ajuste os filtros ou volte para o estoque completo.
        </p>
      </div>

      <Link
        href={`/sites/${slug}/estoque`}
        onClick={onClear}
        style={{
          backgroundColor: "var(--site-primary)",
          color: "var(--site-text-on-primary)",
        }}
        className="inline-flex h-12 items-center justify-center rounded-[var(--auto-radius-md,8px)] px-6 text-sm font-medium transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
      >
        Limpar filtros
      </Link>
    </div>
  );
}
