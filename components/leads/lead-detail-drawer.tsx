"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  LEAD_STAGES,
  type LeadStage,
} from "@/lib/validators/leads";
import type { LeadListItem, LeadTagSummary } from "@/lib/leads/list-leads";
import { cn } from "@/lib/utils";

interface LeadDetailDrawerProps {
  lead: LeadListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: LeadTagSummary[];
}

const STAGE_LABEL: Record<LeadStage, string> = {
  new: "Novo",
  contacted: "Contatado",
  in_conversation: "Em conversa",
  qualified: "Qualificado",
  closed_won: "Ganho",
  closed_lost: "Perdido",
};

function formatLocation(lead: LeadListItem): string | null {
  const parts = [lead.city, lead.state].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  return parts.join(" / ");
}

type Patch = Partial<{
  stage: LeadStage;
  score: number;
  notes: string | null;
  tagIds: string[];
}>;

export function LeadDetailDrawer({
  lead,
  open,
  onOpenChange,
  tags,
}: LeadDetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 sm:max-w-xl"
      >
        {lead ? (
          <DrawerBody key={lead.id} initialLead={lead} tags={tags} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

interface DrawerBodyProps {
  initialLead: LeadListItem;
  tags: LeadTagSummary[];
}

function DrawerBody({ initialLead, tags }: DrawerBodyProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<LeadListItem>(initialLead);
  const [, startTransition] = useTransition();

  async function applyPatch(patch: Patch, optimistic: LeadListItem) {
    const previous = snapshot;
    setSnapshot(optimistic);
    try {
      const response = await fetch(`/api/leads/${previous.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Falha ao atualizar");
      }
      const updated = (await response.json()) as LeadListItem;
      setSnapshot(updated);
      toast.success("Lead atualizado");
      startTransition(() => router.refresh());
    } catch (error) {
      setSnapshot(previous);
      toast.error(
        error instanceof Error ? error.message : "Falha ao atualizar lead",
      );
    }
  }

  return (
    <>
      <SheetHeader className="border-b px-6 py-5">
        <SheetTitle className="text-xl font-semibold">
          {snapshot.name}
        </SheetTitle>
        <SheetDescription className="text-muted-foreground text-xs">
          Editar stage, score, notas e tags. Mudanças persistem imediatamente
          via PATCH.
        </SheetDescription>
      </SheetHeader>

      <Tabs defaultValue="overview" className="flex-1 overflow-hidden">
        <TabsList className="mx-6 mt-4">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="notes">Notas</TabsTrigger>
          <TabsTrigger value="messages">Mensagens IA</TabsTrigger>
        </TabsList>

        <TabsContent
          value="overview"
          className="flex-1 overflow-y-auto px-6 py-4 text-sm"
        >
          <OverviewTab snapshot={snapshot} tags={tags} onPatch={applyPatch} />
        </TabsContent>

        <TabsContent
          value="notes"
          className="flex-1 overflow-y-auto px-6 py-4"
        >
          <NotesTab snapshot={snapshot} onPatch={applyPatch} />
        </TabsContent>

        <TabsContent
          value="messages"
          className="flex-1 overflow-y-auto px-6 py-4"
        >
          <div className="border-border flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
            <Sparkles className="text-muted-foreground size-6" />
            <p className="text-base font-medium">Em breve</p>
            <p className="text-muted-foreground text-sm">
              Geração de mensagens com IA chega na próxima entrega (issue
              #33).
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <SheetFooter className="border-t px-6 py-4">
        <SheetClose asChild>
          <Button variant="outline" className="w-full">
            Fechar
          </Button>
        </SheetClose>
      </SheetFooter>
    </>
  );
}

interface OverviewTabProps {
  snapshot: LeadListItem;
  tags: LeadTagSummary[];
  onPatch: (patch: Patch, optimistic: LeadListItem) => Promise<void>;
}

function OverviewTab({ snapshot, tags, onPatch }: OverviewTabProps) {
  // O componente é re-montado por `key={snapshot.id}` quando o user abre
  // outro lead — então o estado local sempre começa do snapshot atual sem
  // precisar de useEffect.
  const [scoreInput, setScoreInput] = useState(String(snapshot.score));
  const [tagOpen, setTagOpen] = useState(false);
  const [pendingTagIds, setPendingTagIds] = useState<string[]>(
    snapshot.tags.map((tag) => tag.id),
  );
  const [busy, setBusy] = useState<"stage" | "score" | "tags" | null>(null);

  async function changeStage(value: string) {
    if (value === snapshot.stage) return;
    setBusy("stage");
    await onPatch(
      { stage: value as LeadStage },
      { ...snapshot, stage: value as LeadStage },
    );
    setBusy(null);
  }

  async function commitScore() {
    const next = Number(scoreInput);
    if (Number.isNaN(next) || next < 0 || next > 100) {
      setScoreInput(String(snapshot.score));
      toast.error("Score precisa estar entre 0 e 100");
      return;
    }
    if (next === snapshot.score) return;
    setBusy("score");
    await onPatch({ score: next }, { ...snapshot, score: next });
    setBusy(null);
  }

  async function onTagPopoverChange(open: boolean) {
    setTagOpen(open);
    if (open) return;
    const previous = snapshot.tags.map((tag) => tag.id);
    const same =
      previous.length === pendingTagIds.length &&
      previous.every((id) => pendingTagIds.includes(id));
    if (same) return;
    setBusy("tags");
    const optimisticTags = tags.filter((tag) => pendingTagIds.includes(tag.id));
    await onPatch(
      { tagIds: pendingTagIds },
      { ...snapshot, tags: optimisticTags },
    );
    setBusy(null);
  }

  function toggleTag(tagId: string) {
    setPendingTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  }

  return (
    <div className="space-y-5">
      <section className="space-y-1">
        <label
          htmlFor="lead-stage"
          className="text-muted-foreground text-xs uppercase tracking-wide"
        >
          Estágio
        </label>
        <select
          id="lead-stage"
          aria-label="Estágio"
          value={snapshot.stage}
          disabled={busy === "stage"}
          onChange={(event) => changeStage(event.target.value)}
          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
        >
          {LEAD_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABEL[stage]}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-1">
        <label
          htmlFor="lead-score"
          className="text-muted-foreground text-xs uppercase tracking-wide"
        >
          Score (0–100)
        </label>
        <Input
          id="lead-score"
          aria-label="Score"
          type="number"
          min={0}
          max={100}
          value={scoreInput}
          onChange={(event) => setScoreInput(event.target.value)}
          onBlur={() => {
            void commitScore();
          }}
          disabled={busy === "score"}
        />
      </section>

      {snapshot.category ? (
        <section className="space-y-1">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Categoria
          </p>
          <p>{snapshot.category}</p>
        </section>
      ) : null}

      {formatLocation(snapshot) ? (
        <section className="space-y-1">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Localização
          </p>
          <p>{formatLocation(snapshot)}</p>
        </section>
      ) : null}

      <Separator />

      <section className="space-y-2">
        <p className="text-muted-foreground text-xs uppercase tracking-wide">
          Contato
        </p>
        {snapshot.phone ? <p>{snapshot.phone}</p> : null}
        {snapshot.email ? <p>{snapshot.email}</p> : null}
        {snapshot.website ? <p>{snapshot.website}</p> : null}
        {snapshot.instagram_handle ? (
          <p>@{snapshot.instagram_handle}</p>
        ) : null}
        {!snapshot.phone &&
        !snapshot.email &&
        !snapshot.website &&
        !snapshot.instagram_handle ? (
          <p className="text-muted-foreground">Nenhum contato cadastrado.</p>
        ) : null}
      </section>

      <Separator />

      <section className="space-y-2">
        <p className="text-muted-foreground text-xs uppercase tracking-wide">
          Tags
        </p>
        <Popover open={tagOpen} onOpenChange={onTagPopoverChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              aria-haspopup="listbox"
              aria-expanded={tagOpen}
              className="h-9 w-full justify-between"
              disabled={busy === "tags"}
            >
              <span>
                {pendingTagIds.length === 0
                  ? "Selecionar tags…"
                  : `${pendingTagIds.length} selecionada(s)`}
              </span>
              {busy === "tags" ? (
                <Loader2 className="size-4 animate-spin opacity-60" />
              ) : (
                <ChevronDown className="size-4 opacity-60" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Filtrar tags…" />
              <CommandList>
                <CommandEmpty>Nenhuma tag.</CommandEmpty>
                <CommandGroup>
                  {tags.map((tag) => {
                    const isSelected = pendingTagIds.includes(tag.id);
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
        {snapshot.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {snapshot.tags.map((tag) => (
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
      </section>
    </div>
  );
}

interface NotesTabProps {
  snapshot: LeadListItem;
  onPatch: (patch: Patch, optimistic: LeadListItem) => Promise<void>;
}

function NotesTab({ snapshot, onPatch }: NotesTabProps) {
  // Re-montado via `key={notes-<id>}` quando o user troca de lead.
  const [draft, setDraft] = useState(snapshot.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if ((snapshot.notes ?? "") === draft) return;
    setSaving(true);
    const value = draft.length === 0 ? null : draft;
    await onPatch({ notes: value }, { ...snapshot, notes: value });
    setSaving(false);
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <label
        htmlFor="lead-notes"
        className="text-muted-foreground text-xs uppercase tracking-wide"
      >
        Notas internas
      </label>
      <Textarea
        id="lead-notes"
        aria-label="Notas internas"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Anotações livres sobre este lead…"
        className="min-h-40 flex-1"
      />
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            void save();
          }}
          disabled={saving || (snapshot.notes ?? "") === draft}
        >
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Salvar notas
        </Button>
      </div>
    </div>
  );
}
