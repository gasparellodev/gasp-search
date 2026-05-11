"use client";

import { ChevronDown } from "lucide-react";
import { Accordion } from "radix-ui";

import type {
  StockCategorySlug,
  StockFilterFacets,
  StockFilters,
} from "@/lib/sites/stock-search-params";
import { cn } from "@/lib/utils";

interface StockFilterControlsProps {
  facets: StockFilterFacets;
  filters: StockFilters;
  onFiltersChange: (filters: StockFilters) => void;
  onClear: () => void;
}

type ArrayFilterKey =
  | "marca"
  | "modelo"
  | "categoria"
  | "cambio"
  | "combustivel"
  | "cor";

const CATEGORY_LABELS: Record<StockCategorySlug, string> = {
  sedan: "Sedan",
  suv: "SUV",
  hatch: "Hatch",
  pickup: "Pickup",
  esportivo: "Esportivo",
  conversivel: "Conversível",
};

export function StockFilterControls({
  facets,
  filters,
  onFiltersChange,
  onClear,
}: StockFilterControlsProps) {
  function setArrayValue<T extends string>(
    key: ArrayFilterKey,
    value: T,
    checked: boolean,
  ) {
    const current = filters[key] as string[];
    const next = checked
      ? [...current, value]
      : current.filter((item) => item !== value);
    onFiltersChange({ ...filters, [key]: next });
  }

  function setNumberValue(
    key:
      | "precoMin"
      | "precoMax"
      | "parcelaMin"
      | "parcelaMax"
      | "anoMin"
      | "anoMax"
      | "kmMin"
      | "kmMax",
    value: string,
  ) {
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    onFiltersChange({
      ...filters,
      [key]:
        trimmed.length === 0 || !Number.isFinite(parsed)
          ? null
          : Math.max(0, Math.floor(parsed)),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--auto-foreground,#0a0a0a)]">
          Filtros
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-sm font-medium text-[var(--auto-muted-foreground,#737373)] underline-offset-4 hover:text-[var(--auto-foreground,#0a0a0a)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-primary,#0a0a0a)]/30"
        >
          Limpar filtros
        </button>
      </div>

      <Accordion.Root
        type="multiple"
        defaultValue={["marca", "modelo"]}
        className="divide-y divide-[var(--auto-border,#e5e5e5)]"
      >
        <CheckboxSection
          title="Marca"
          count={filters.marca.length}
          value="marca"
          options={facets.marcas.map((value) => ({ value, label: value }))}
          selected={filters.marca}
          onChange={(value, checked) => setArrayValue("marca", value, checked)}
        />
        <CheckboxSection
          title="Modelo"
          count={filters.modelo.length}
          value="modelo"
          options={facets.modelos.map((value) => ({ value, label: value }))}
          selected={filters.modelo}
          onChange={(value, checked) => setArrayValue("modelo", value, checked)}
        />
        <CheckboxSection
          title="Categoria"
          count={filters.categoria.length}
          value="categoria"
          options={facets.categorias.map((value) => ({
            value,
            label: CATEGORY_LABELS[value],
          }))}
          selected={filters.categoria}
          onChange={(value, checked) =>
            setArrayValue("categoria", value, checked)
          }
        />
        <RangeSection
          title="Faixa preço"
          value="preco"
          minLabel="Preço mínimo"
          maxLabel="Preço máximo"
          min={filters.precoMin}
          max={filters.precoMax}
          range={facets.ranges.preco}
          onMinChange={(value) => setNumberValue("precoMin", value)}
          onMaxChange={(value) => setNumberValue("precoMax", value)}
        />
        <RangeSection
          title="Parcela mensal"
          value="parcela"
          minLabel="Parcela mínima"
          maxLabel="Parcela máxima"
          min={filters.parcelaMin}
          max={filters.parcelaMax}
          range={facets.ranges.parcela}
          onMinChange={(value) => setNumberValue("parcelaMin", value)}
          onMaxChange={(value) => setNumberValue("parcelaMax", value)}
        />
        <RangeSection
          title="Ano"
          value="ano"
          minLabel="Ano mínimo"
          maxLabel="Ano máximo"
          min={filters.anoMin}
          max={filters.anoMax}
          range={facets.ranges.ano}
          onMinChange={(value) => setNumberValue("anoMin", value)}
          onMaxChange={(value) => setNumberValue("anoMax", value)}
        />
        <RangeSection
          title="KM"
          value="km"
          minLabel="KM mínimo"
          maxLabel="KM máximo"
          min={filters.kmMin}
          max={filters.kmMax}
          range={facets.ranges.km}
          onMinChange={(value) => setNumberValue("kmMin", value)}
          onMaxChange={(value) => setNumberValue("kmMax", value)}
        />
        <CheckboxSection
          title="Câmbio"
          count={filters.cambio.length}
          value="cambio"
          options={facets.cambios.map((value) => ({ value, label: value }))}
          selected={filters.cambio}
          onChange={(value, checked) => setArrayValue("cambio", value, checked)}
        />
        <CheckboxSection
          title="Combustível"
          count={filters.combustivel.length}
          value="combustivel"
          options={facets.combustiveis.map((value) => ({
            value,
            label: value,
          }))}
          selected={filters.combustivel}
          onChange={(value, checked) =>
            setArrayValue("combustivel", value, checked)
          }
        />
        <CheckboxSection
          title="Cor"
          count={filters.cor.length}
          value="cor"
          options={facets.cores.map((value) => ({ value, label: value }))}
          selected={filters.cor}
          onChange={(value, checked) => setArrayValue("cor", value, checked)}
        />
      </Accordion.Root>
    </div>
  );
}

interface CheckboxSectionProps<T extends string> {
  title: string;
  count: number;
  value: string;
  options: Array<{ value: T; label: string }>;
  selected: readonly T[];
  onChange: (value: T, checked: boolean) => void;
}

function CheckboxSection<T extends string>({
  title,
  count,
  value,
  options,
  selected,
  onChange,
}: CheckboxSectionProps<T>) {
  return (
    <Accordion.Item data-testid="stock-filter-section" value={value}>
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full items-center justify-between gap-3 py-4 text-left text-sm font-semibold text-[var(--auto-foreground,#0a0a0a)]">
          <span>
            {title}
            {count > 0 ? ` (${count})` : ""}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 transition group-data-[state=open]:rotate-180"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="pb-4">
        <div className="grid gap-2">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-[var(--auto-foreground,#0a0a0a)]"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={(event) => onChange(option.value, event.target.checked)}
                className="size-4 rounded border-[var(--auto-border,#e5e5e5)] accent-[var(--auto-primary,#0a0a0a)]"
              />
              <span className="capitalize">{option.label}</span>
            </label>
          ))}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}

interface RangeSectionProps {
  title: string;
  value: string;
  minLabel: string;
  maxLabel: string;
  min: number | null;
  max: number | null;
  range: { min: number; max: number };
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}

function RangeSection({
  title,
  value,
  minLabel,
  maxLabel,
  min,
  max,
  range,
  onMinChange,
  onMaxChange,
}: RangeSectionProps) {
  const count = Number(min !== null) + Number(max !== null);
  return (
    <Accordion.Item data-testid="stock-filter-section" value={value}>
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full items-center justify-between gap-3 py-4 text-left text-sm font-semibold text-[var(--auto-foreground,#0a0a0a)]">
          <span>
            {title}
            {count > 0 ? ` (${count})` : ""}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 transition group-data-[state=open]:rotate-180"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="pb-4">
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label={minLabel}
            value={min}
            min={range.min}
            max={range.max}
            onChange={onMinChange}
          />
          <NumberInput
            label={maxLabel}
            value={max}
            min={range.min}
            max={range.max}
            onChange={onMaxChange}
          />
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}

interface NumberInputProps {
  label: string;
  value: number | null;
  min: number;
  max: number;
  onChange: (value: string) => void;
}

function NumberInput({ label, value, min, max, onChange }: NumberInputProps) {
  const id = `stock-${label.toLocaleLowerCase("pt-BR").replace(/\s+/g, "-")}`;
  return (
    <label className="grid gap-1 text-xs font-medium text-[var(--auto-muted-foreground,#737373)]">
      <span>{label}</span>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-10 min-w-0 rounded-[var(--auto-radius-md,8px)] border border-[var(--auto-border,#e5e5e5)] bg-[var(--auto-surface,#fff)] px-3 text-sm text-[var(--auto-foreground,#0a0a0a)] outline-none",
          "focus:border-[var(--auto-primary,#0a0a0a)] focus:ring-2 focus:ring-[var(--auto-primary,#0a0a0a)]/20",
        )}
      />
    </label>
  );
}
