"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

interface StockPaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
}

export function StockPagination({
  page,
  totalPages,
  pageSize,
  hasPreviousPage,
  hasNextPage,
  onPageChange,
}: StockPaginationProps) {
  if (totalPages <= 1) {
    return (
      <div className="mt-8 flex justify-center">
        <button
          type="button"
          disabled
          aria-label="Página anterior"
          className="sr-only"
        />
        <button
          type="button"
          disabled
          aria-label="Próxima página"
          className="sr-only"
        />
      </div>
    );
  }

  const pages = buildPageList(page, totalPages);

  return (
    <nav
      aria-label="Paginação do estoque"
      className="mt-8 flex flex-col items-center gap-4"
    >
      <p className="text-sm text-[var(--auto-muted-foreground,#737373)]">
        Página {page} de {totalPages}
      </p>

      <div className="hidden items-center gap-2 md:flex">
        <IconButton
          label="Página anterior"
          disabled={!hasPreviousPage}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden className="size-4" />
        </IconButton>

        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            aria-label={`Ir para página ${pageNumber}`}
            aria-current={pageNumber === page ? "page" : undefined}
            onClick={() => onPageChange(pageNumber)}
            className="inline-flex size-10 items-center justify-center rounded-[var(--auto-radius-md,8px)] border border-[var(--auto-border,#e5e5e5)] text-sm font-medium text-[var(--auto-foreground,#0a0a0a)] transition hover:border-[var(--auto-border-strong,#a3a3a3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-primary,#0a0a0a)]/30 aria-[current=page]:border-[var(--site-primary)] aria-[current=page]:bg-[var(--site-primary)] aria-[current=page]:text-[var(--site-text-on-primary)]"
          >
            {pageNumber}
          </button>
        ))}

        <IconButton
          label="Próxima página"
          disabled={!hasNextPage}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight aria-hidden className="size-4" />
        </IconButton>
      </div>

      {hasNextPage && (
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-11 items-center justify-center rounded-[var(--auto-radius-md,8px)] border border-[var(--auto-border,#e5e5e5)] bg-[var(--auto-surface,#fff)] px-5 text-sm font-medium text-[var(--auto-foreground,#0a0a0a)] transition hover:border-[var(--auto-border-strong,#a3a3a3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-primary,#0a0a0a)]/30 md:hidden"
        >
          Carregar mais {pageSize}
        </button>
      )}
    </nav>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-10 items-center justify-center rounded-[var(--auto-radius-md,8px)] border border-[var(--auto-border,#e5e5e5)] text-[var(--auto-foreground,#0a0a0a)] transition hover:border-[var(--auto-border-strong,#a3a3a3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-primary,#0a0a0a)]/30 disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function buildPageList(page: number, totalPages: number): number[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}
