"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STOCK_SORT_OPTIONS,
  type StockSortKey,
} from "@/lib/stock/sort";

interface StockSortDropdownProps {
  value: StockSortKey;
  onValueChange: (value: StockSortKey) => void;
}

export function StockSortDropdown({
  value,
  onValueChange,
}: StockSortDropdownProps) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as StockSortKey)}>
      <SelectTrigger
        aria-label="Ordenar estoque"
        className="h-11 min-w-[168px] rounded-[var(--auto-radius-md,8px)] border-[var(--auto-border,#e5e5e5)] bg-[var(--auto-surface,#fff)] text-[var(--auto-foreground,#0a0a0a)] focus-visible:border-[var(--auto-primary,#0a0a0a)] focus-visible:ring-[var(--auto-primary,#0a0a0a)]/20"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="z-[var(--z-stock-drawer,60)]">
        {STOCK_SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
