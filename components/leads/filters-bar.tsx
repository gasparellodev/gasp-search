"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  LEAD_SOURCES,
  LEAD_STAGES,
  type LeadFilters,
  type LeadSource,
  type LeadStage,
} from "@/lib/validators/leads";
import type { LeadTagSummary } from "@/lib/leads/list-leads";
import { cn } from "@/lib/utils";

interface FiltersBarProps {
  tags: LeadTagSummary[];
  filters: LeadFilters;
}

const STAGE_LABEL: Record<LeadStage, string> = {
  new: "Novo",
  contacted: "Contatado",
  in_conversation: "Em conversa",
  qualified: "Qualificado",
  closed_won: "Ganho",
  closed_lost: "Perdido",
};

const SOURCE_LABEL: Record<LeadSource, string> = {
  google_maps: "Google Maps",
  instagram: "Instagram",
  website_contact: "Site (contato)",
};

const FILTER_KEYS = ["q", "stage", "source", "hasWebsite", "tagId"] as const;

export function FiltersBar({ tags, filters }: FiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Estado local do form vive enquanto o popover está aberto / o input está
  // sendo digitado. Após o submit, o URL muda e o Server Component re-monta
  // este componente com `filters` atualizado — sem precisar de useEffect.
  const [q, setQ] = useState(filters.q ?? "");
  const [tagOpen, setTagOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    filters.tagIds ?? [],
  );

  function buildParams(updates: Record<string, string | string[] | null>) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [key, value] of Object.entries(updates)) {
      params.delete(key);
      if (value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, v);
      } else {
        params.set(key, value);
      }
    }
    params.set("page", "1");
    return params;
  }

  function pushParams(updates: Record<string, string | string[] | null>) {
    const params = buildParams(updates);
    router.push(`${pathname}?${params.toString()}`);
  }

  function onSelectStage(value: string) {
    pushParams({ stage: value === "" ? null : value });
  }

  function onSelectSource(value: string) {
    pushParams({ source: value === "" ? null : value });
  }

  function onSelectHasWebsite(value: string) {
    pushParams({ hasWebsite: value === "" ? null : value });
  }

  function onSubmitQ(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = q.trim();
    pushParams({ q: trimmed.length >= 2 ? trimmed : null });
  }

  function clearAll() {
    const updates = Object.fromEntries(
      FILTER_KEYS.map((key) => [key, null] as const),
    );
    pushParams(updates);
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  }

  function onTagPopoverChange(open: boolean) {
    setTagOpen(open);
    if (open) return;
    // Aplicar mudança ao fechar.
    const previous = filters.tagIds ?? [];
    const same =
      previous.length === selectedTagIds.length &&
      previous.every((id) => selectedTagIds.includes(id));
    if (same) return;
    pushParams({
      tagId: selectedTagIds.length > 0 ? selectedTagIds : null,
    });
  }

  return (
    <div className="border-border bg-card grid min-w-0 gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_140px_140px_140px_180px_auto] lg:items-end">
      <form
        onSubmit={onSubmitQ}
        className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-1"
      >
        <label
          htmlFor="leads-q"
          className="text-muted-foreground text-xs uppercase tracking-wide"
        >
          Buscar pelo nome
        </label>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2" />
          <Input
            id="leads-q"
            type="search"
            placeholder="Ex: barbearia"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="pl-8"
          />
        </div>
      </form>

      <div className="flex min-w-0 flex-col gap-1">
        <label
          htmlFor="leads-stage"
          className="text-muted-foreground text-xs uppercase tracking-wide"
        >
          Estágio
        </label>
        <select
          id="leads-stage"
          aria-label="Estágio"
          value={filters.stage ?? ""}
          onChange={(event) => onSelectStage(event.target.value)}
          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
        >
          <option value="">Todos</option>
          {LEAD_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABEL[stage]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <label
          htmlFor="leads-source"
          className="text-muted-foreground text-xs uppercase tracking-wide"
        >
          Origem
        </label>
        <select
          id="leads-source"
          aria-label="Origem"
          value={filters.source ?? ""}
          onChange={(event) => onSelectSource(event.target.value)}
          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
        >
          <option value="">Todas</option>
          {LEAD_SOURCES.map((source) => (
            <option key={source} value={source}>
              {SOURCE_LABEL[source]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <label
          htmlFor="leads-has-website"
          className="text-muted-foreground text-xs uppercase tracking-wide"
        >
          Tem site?
        </label>
        <select
          id="leads-has-website"
          aria-label="Tem site?"
          value={
            filters.hasWebsite === undefined
              ? ""
              : filters.hasWebsite
                ? "true"
                : "false"
          }
          onChange={(event) => onSelectHasWebsite(event.target.value)}
          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
        >
          <option value="">Indiferente</option>
          <option value="true">Com site</option>
          <option value="false">Sem site</option>
        </select>
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-muted-foreground text-xs uppercase tracking-wide">
          Tags
        </span>
        <Popover open={tagOpen} onOpenChange={onTagPopoverChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              aria-haspopup="listbox"
              aria-expanded={tagOpen}
              className="h-9 w-full justify-between"
            >
              <span>
                Tags
                {selectedTagIds.length > 0
                  ? ` · ${selectedTagIds.length}`
                  : ""}
              </span>
              <ChevronDown className="size-4 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(16rem,calc(100vw-2rem))] p-0" align="start">
            <Command>
              <CommandInput placeholder="Filtrar tags…" />
              <CommandList>
                <CommandEmpty>Nenhuma tag.</CommandEmpty>
                <CommandGroup>
                  {tags.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <CommandItem
                        key={tag.id}
                        value={tag.name}
                        onSelect={() => toggleTag(tag.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: tag.color }}
                          aria-hidden="true"
                        />
                        <span className="ml-2">{tag.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedTagIds.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {tags
              .filter((tag) => selectedTagIds.includes(tag.id))
              .map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  style={{ borderColor: tag.color, color: tag.color }}
                >
                  {tag.name}
                </Badge>
              ))}
          </div>
        ) : null}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={clearAll}
        className="h-9 w-full sm:w-auto"
      >
        <X className="mr-1 size-4" />
        Limpar
      </Button>
    </div>
  );
}
