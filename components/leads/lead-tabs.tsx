"use client";

/**
 * `<LeadTabs />` — componente canônico de tabs do lead (issue #136).
 *
 * Substitui as tabs ad-hoc do `<LeadDetailDrawer />` (inline) e do
 * `/leads/[id]/page.tsx` (standalone) por uma UI única com 4 tabs
 * canônicas + Site (opt-in via slot). Edição inline (PATCH) é
 * consolidada aqui — campos `name`, `phone`, `stage`, `score`, `notes`,
 * `tagIds` — com validação Zod (`updateLeadSchema`) antes de qualquer
 * side effect.
 *
 * **Modos:**
 *  - `inline`: spacing tighter, scroll interno (encaixa em Sheet).
 *  - `standalone`: hero header + spacing folgado para full-page.
 *
 * **Slots opcionais:**
 *  - `siteCard`: ReactNode renderizado na tab "Site". Em standalone,
 *    o parent passa `<LeadSiteCard />` (Server). Em inline, passa
 *    `<LeadSiteCardClient />`.
 *  - `messageHistory`: ReactNode renderizado abaixo do `<MessageGenerator>`
 *    na tab "Mensagens IA". Em standalone, o parent passa
 *    `<MessageHistory ... />` com a página atual. Em inline, undefined.
 */

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { MessageGenerator } from "@/components/ai/message-generator";
import { ConversationThread } from "@/components/messages/conversation-thread";
import { InstanceBanner } from "@/components/messages/instance-banner";
import { MessageComposer } from "@/components/messages/message-composer";
import { publicEnv } from "@/lib/env-public";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  LEAD_STAGES,
  updateLeadSchema,
  type LeadStage,
  type UpdateLeadInput,
} from "@/lib/validators/leads";
import { STAGE_LABEL, STAGE_VARIANT } from "@/lib/leads/stage-presentation";
import type { LeadListItem, LeadTagSummary } from "@/lib/leads/list-leads";
import { cn } from "@/lib/utils";

export type LeadTabsMode = "inline" | "standalone";
export type LeadTabsValue =
  | "overview"
  | "notes"
  | "messages"
  | "conversation"
  | "site";

export interface LeadTabsProps {
  lead: LeadListItem;
  mode: LeadTabsMode;
  /** Tags do user para o combobox de seleção em Visão geral. */
  tags?: LeadTagSummary[];
  /** Slot renderizado na tab Site. Em standalone use Server; em inline use Client. */
  siteCard?: ReactNode;
  /** Slot renderizado abaixo do `<MessageGenerator>` em Mensagens IA. */
  messageHistory?: ReactNode;
  /**
   * Override do PATCH default. Quando provido, o componente delega; quando
   * ausente, o componente faz `fetch('/api/leads/[id]', ...)` direto.
   * O optimistic state é aplicado de qualquer forma.
   */
  onUpdate?: (
    patch: UpdateLeadInput,
    optimistic: LeadListItem,
  ) => Promise<void>;
  /** Tab inicial; default `overview`. */
  defaultTab?: LeadTabsValue;
}

/**
 * `key={lead.id}` no parent garante que o estado interno (snapshots locais,
 * draft de notes, pendingTagIds) re-monte ao trocar de lead — sem
 * `useEffect` de sincronização e sem o lint `react-hooks/set-state-in-effect`.
 */
export function LeadTabs(props: LeadTabsProps) {
  return <LeadTabsInner key={props.lead.id} {...props} />;
}

function LeadTabsInner({
  lead,
  mode,
  tags = [],
  siteCard,
  messageHistory,
  onUpdate,
  defaultTab = "overview",
}: LeadTabsProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<LeadListItem>(lead);
  const [, startTransition] = useTransition();

  async function applyPatch(
    patch: UpdateLeadInput,
    optimistic: LeadListItem,
  ): Promise<boolean> {
    const previous = snapshot;
    setSnapshot(optimistic);

    if (onUpdate) {
      try {
        await onUpdate(patch, optimistic);
        return true;
      } catch (error) {
        setSnapshot(previous);
        toast.error(
          error instanceof Error ? error.message : "Falha ao atualizar lead",
        );
        return false;
      }
    }

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
      return true;
    } catch (error) {
      setSnapshot(previous);
      toast.error(
        error instanceof Error ? error.message : "Falha ao atualizar lead",
      );
      return false;
    }
  }

  /**
   * Roda `updateLeadSchema.safeParse` antes de qualquer side effect.
   * Retorna `true` quando o patch foi aceito (validação + dispatch ok).
   * `false` quando validação falhou — neste caso o caller deve restaurar
   * o input local para o valor do snapshot.
   */
  async function validateAndPatch(
    patch: UpdateLeadInput,
    optimistic: LeadListItem,
  ): Promise<boolean> {
    const parsed = updateLeadSchema.safeParse(patch);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first?.message ?? "Valor inválido");
      return false;
    }
    return applyPatch(parsed.data, optimistic);
  }

  const whatsappEnabled = publicEnv.NEXT_PUBLIC_WHATSAPP_ENABLED === "1";
  const showSiteTab = siteCard !== undefined;

  const isStandalone = mode === "standalone";
  const padding = isStandalone ? "px-0 py-5" : "px-4 py-4 sm:px-6";
  const triggerWrapClass = isStandalone
    ? "flex w-full flex-wrap gap-1 sm:flex-nowrap"
    : "mx-4 mt-4 flex w-[calc(100%-2rem)] flex-wrap gap-1 sm:mx-6 sm:w-[calc(100%-3rem)] sm:flex-nowrap";

  return (
    <div
      data-lead-tabs="true"
      data-mode={mode}
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        isStandalone ? "gap-6" : "gap-0",
      )}
    >
      {isStandalone ? (
        <header className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="sk-h1">{snapshot.name}</h1>
              <p className="sk-body-lg text-muted-foreground mt-2">
                {compactPresentation(snapshot) || "Lead sem categoria"}
              </p>
            </div>
            <Badge variant={STAGE_VARIANT[snapshot.stage]}>
              {STAGE_LABEL[snapshot.stage]}
            </Badge>
          </div>
        </header>
      ) : null}

      <Tabs
        defaultValue={defaultTab}
        className={cn(
          "min-h-0 flex-1",
          isStandalone ? "gap-4" : "overflow-hidden",
        )}
      >
        <TabsList className={triggerWrapClass}>
          <TabsTrigger value="overview" className="flex-1 min-w-0">
            Visão geral
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex-1 min-w-0">
            Notas
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex-1 min-w-0">
            Mensagens IA
          </TabsTrigger>
          {whatsappEnabled ? (
            <TabsTrigger
              value="conversation"
              data-testid="tab-conversation"
              className="flex-1 min-w-0"
            >
              Conversa
            </TabsTrigger>
          ) : null}
          {showSiteTab ? (
            <TabsTrigger
              value="site"
              data-testid="tab-site"
              className="flex-1 min-w-0"
            >
              Site
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent
          value="overview"
          className={cn(
            "min-h-0 flex-1 text-sm",
            isStandalone ? "py-2" : "overflow-y-auto px-4 py-4 sm:px-6",
          )}
        >
          <OverviewTab
            snapshot={snapshot}
            tags={tags}
            onPatch={validateAndPatch}
          />
        </TabsContent>

        <TabsContent
          value="notes"
          className={cn(
            "min-h-0 flex-1",
            isStandalone ? "py-2" : "overflow-y-auto px-4 py-4 sm:px-6",
          )}
        >
          <NotesTab snapshot={snapshot} onPatch={validateAndPatch} />
        </TabsContent>

        <TabsContent
          value="messages"
          className={cn(
            "min-h-0 flex-1",
            isStandalone ? "py-2 space-y-6" : "overflow-y-auto px-4 py-4 sm:px-6 space-y-6",
          )}
        >
          <MessageGenerator leadId={snapshot.id} />
          {messageHistory}
        </TabsContent>

        {whatsappEnabled ? (
          <TabsContent
            value="conversation"
            className={cn(
              "min-h-0 flex-1 flex flex-col",
              isStandalone ? "" : "",
            )}
            data-testid="conversation-tab-content"
          >
            <InstanceBanner />
            <div className="flex-1 min-h-0">
              <ConversationThread leadId={snapshot.id} />
            </div>
            <MessageComposer leadId={snapshot.id} />
          </TabsContent>
        ) : null}

        {showSiteTab ? (
          <TabsContent
            value="site"
            className={cn(
              "min-h-0 flex-1",
              isStandalone ? "py-2" : "overflow-y-auto px-4 py-4 sm:px-6",
            )}
            data-testid="site-tab-content"
          >
            {siteCard}
          </TabsContent>
        ) : null}
      </Tabs>

      <p data-testid="lead-tabs-padding-hint" hidden>
        {padding}
      </p>
    </div>
  );
}

function compactPresentation(lead: LeadListItem): string {
  const location = [lead.city, lead.state, lead.country]
    .filter(Boolean)
    .join(" / ");
  const parts: string[] = [];
  if (lead.category) parts.push(lead.category);
  if (location) parts.push(location);
  return parts.join(" / ");
}

interface OverviewTabProps {
  snapshot: LeadListItem;
  tags: LeadTagSummary[];
  onPatch: (
    patch: UpdateLeadInput,
    optimistic: LeadListItem,
  ) => Promise<boolean>;
}

function OverviewTab({ snapshot, tags, onPatch }: OverviewTabProps) {
  // Estado local de inputs textuais. `key={snapshot.id}` no parent garante
  // re-mount ao trocar de lead, então estes useState sempre começam corretos.
  const [nameDraft, setNameDraft] = useState(snapshot.name);
  const [phoneDraft, setPhoneDraft] = useState(snapshot.phone ?? "");
  const [scoreInput, setScoreInput] = useState(String(snapshot.score));
  const [tagOpen, setTagOpen] = useState(false);
  const [pendingTagIds, setPendingTagIds] = useState<string[]>(
    snapshot.tags.map((tag) => tag.id),
  );
  const [tagSearch, setTagSearch] = useState("");
  const [availableTags, setAvailableTags] = useState<LeadTagSummary[]>(tags);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<
    "stage" | "score" | "tags" | "name" | "phone" | null
  >(null);

  async function commitName() {
    const trimmed = nameDraft.trim();
    if (trimmed === snapshot.name) return;
    setBusy("name");
    const ok = await onPatch(
      { name: trimmed },
      { ...snapshot, name: trimmed },
    );
    if (!ok) setNameDraft(snapshot.name);
    setBusy(null);
  }

  async function commitPhone() {
    const trimmed = phoneDraft.trim();
    const next = trimmed.length === 0 ? null : trimmed;
    if (next === (snapshot.phone ?? null)) return;
    setBusy("phone");
    const ok = await onPatch(
      { phone: next },
      { ...snapshot, phone: next },
    );
    if (!ok) setPhoneDraft(snapshot.phone ?? "");
    setBusy(null);
  }

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
    const optimisticTags = availableTags.filter((tag) =>
      pendingTagIds.includes(tag.id),
    );
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

  async function createTagInline(name: string) {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    setCreating(true);
    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Falha ao criar tag");
      }
      const tag = (await response.json()) as LeadTagSummary;
      setAvailableTags((current) => [...current, tag]);
      setPendingTagIds((current) => [...current, tag.id]);
      setTagSearch("");
      toast.success(`Tag "${tag.name}" criada`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao criar tag",
      );
    } finally {
      setCreating(false);
    }
  }

  const exactMatch = availableTags.find(
    (tag) => tag.name.toLowerCase() === tagSearch.trim().toLowerCase(),
  );
  const showCreate = tagSearch.trim().length >= 2 && !exactMatch && !creating;

  return (
    <div className="space-y-5">
      <section className="space-y-1">
        <label
          htmlFor="lead-name"
          className="text-muted-foreground text-xs uppercase tracking-wide"
        >
          Nome
        </label>
        <Input
          id="lead-name"
          aria-label="Nome"
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={() => {
            void commitName();
          }}
          disabled={busy === "name"}
        />
      </section>

      <section className="space-y-1">
        <label
          htmlFor="lead-phone"
          className="text-muted-foreground text-xs uppercase tracking-wide"
        >
          Telefone
        </label>
        <Input
          id="lead-phone"
          aria-label="Telefone"
          value={phoneDraft}
          onChange={(event) => setPhoneDraft(event.target.value)}
          onBlur={() => {
            void commitPhone();
          }}
          disabled={busy === "phone"}
          placeholder="Sem telefone cadastrado"
        />
      </section>

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
        {snapshot.email ? <p>{snapshot.email}</p> : null}
        {snapshot.website ? <p>{snapshot.website}</p> : null}
        {snapshot.instagram_handle ? (
          <p>@{snapshot.instagram_handle}</p>
        ) : null}
        {!snapshot.email &&
        !snapshot.website &&
        !snapshot.instagram_handle ? (
          <p className="text-muted-foreground">
            Nenhum contato adicional cadastrado.
          </p>
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
              <CommandInput
                placeholder="Filtrar ou criar tag…"
                value={tagSearch}
                onValueChange={setTagSearch}
              />
              <CommandList>
                <CommandEmpty>Nenhuma tag.</CommandEmpty>
                <CommandGroup>
                  {availableTags.map((tag) => {
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
                  {showCreate ? (
                    <CommandItem
                      value={`__create__${tagSearch}`}
                      onSelect={() => {
                        void createTagInline(tagSearch);
                      }}
                    >
                      <Plus className="mr-2 size-4" />
                      <span>Criar tag &ldquo;{tagSearch.trim()}&rdquo;</span>
                    </CommandItem>
                  ) : null}
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
  onPatch: (
    patch: UpdateLeadInput,
    optimistic: LeadListItem,
  ) => Promise<boolean>;
}

function NotesTab({ snapshot, onPatch }: NotesTabProps) {
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

function formatLocation(lead: LeadListItem): string | null {
  const parts = [lead.city, lead.state].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  return parts.join(" / ");
}
