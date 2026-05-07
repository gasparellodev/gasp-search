"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LEAD_STAGES,
  type LeadStage,
} from "@/lib/validators/leads";
import type {
  PipelineBoard as Board,
  PipelineCard,
} from "@/lib/leads/list-by-stage";

interface PipelineBoardProps {
  board: Board;
  /**
   * Permite que testes injetem um trigger que chama `moveLead` diretamente,
   * desacoplando o teste do simulador de drag&drop do dnd-kit.
   */
  onMoveCommand?: (
    fn: (args: { leadId: string; toStage: LeadStage | string }) => void,
  ) => void;
}

const STAGE_LABEL: Record<LeadStage, string> = {
  new: "Novo",
  contacted: "Contatado",
  in_conversation: "Em conversa",
  qualified: "Qualificado",
  closed_won: "Ganho",
  closed_lost: "Perdido",
};

const STAGE_ACCENT: Record<LeadStage, string> = {
  new: "border-l-sky-400",
  contacted: "border-l-amber-400",
  in_conversation: "border-l-violet-400",
  qualified: "border-l-emerald-400",
  closed_won: "border-l-emerald-600",
  closed_lost: "border-l-rose-500",
};

export function PipelineBoard({
  board,
  onMoveCommand,
}: PipelineBoardProps) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useState<Board>(board);
  const [focusedStage, setFocusedStage] = useState<LeadStage>("new");
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const isEmpty = LEAD_STAGES.every((stage) => optimistic[stage].length === 0);

  function findStageOf(leadId: string): LeadStage | null {
    for (const stage of LEAD_STAGES) {
      if (optimistic[stage].some((card) => card.id === leadId)) return stage;
    }
    return null;
  }

  async function moveLead({
    leadId,
    toStage,
  }: {
    leadId: string;
    toStage: LeadStage | string;
  }) {
    if (!(LEAD_STAGES as readonly string[]).includes(toStage)) return;
    const target = toStage as LeadStage;

    const fromStage = findStageOf(leadId);
    if (!fromStage || fromStage === target) return;

    const previous = optimistic;
    const moved = previous[fromStage].find((card) => card.id === leadId);
    if (!moved) return;

    const next: Board = {
      ...previous,
      [fromStage]: previous[fromStage].filter((card) => card.id !== leadId),
      [target]: [{ ...moved, stage: target }, ...previous[target]],
    };
    setOptimistic(next);

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage: target }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Falha ao mover lead");
      }
      startTransition(() => router.refresh());
    } catch (error) {
      setOptimistic(previous);
      toast.error(
        error instanceof Error ? error.message : "Falha ao mover lead",
      );
    }
  }

  // Permite testes RTL chamar moveLead diretamente sem simular drag.
  useEffect(() => {
    onMoveCommand?.(moveLead);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const leadId = event.active.id;
    const overId = event.over?.id;
    if (typeof leadId !== "string" || typeof overId !== "string") return;
    void moveLead({ leadId, toStage: overId });
  }

  if (isEmpty) {
    return (
      <div className="border-border bg-card flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
          <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-md">
            <Search className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium">Nenhum lead no pipeline</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Faça sua primeira busca para alimentar os estágios do Kanban.
            </p>
          </div>
          <Button asChild>
            <Link href="/search">Faça sua primeira busca</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div
        data-testid="pipeline-viewport"
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        <div className="shrink-0 md:hidden">
          <label
            htmlFor="pipeline-stage"
            className="text-muted-foreground text-xs font-medium uppercase"
          >
            Visualizar estágio
          </label>
          <select
            id="pipeline-stage"
            aria-label="Visualizar estágio"
            value={focusedStage}
            onChange={(event) => setFocusedStage(event.target.value as LeadStage)}
            className="border-input bg-background mt-1 h-9 w-full rounded-md border px-2 text-sm"
          >
            {LEAD_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABEL[stage]} ({optimistic[stage].length})
              </option>
            ))}
          </select>
        </div>

        <div
          data-testid="pipeline-board"
          className="flex h-full min-h-0 min-w-0 flex-1 gap-4 overflow-x-auto pb-2"
        >
          {LEAD_STAGES.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              label={STAGE_LABEL[stage]}
              accent={STAGE_ACCENT[stage]}
              cards={optimistic[stage]}
              highlighted={focusedStage === stage}
            />
          ))}
        </div>
      </div>
    </DndContext>
  );
}

interface ColumnProps {
  stage: LeadStage;
  label: string;
  accent: string;
  cards: PipelineCard[];
  highlighted?: boolean;
}

function Column({ stage, label, accent, cards, highlighted }: ColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: stage });
  return (
    <section
      ref={setNodeRef}
      role="region"
      aria-label={label}
      className={cn(
        "border-border bg-card flex h-full min-h-0 w-[28rem] min-w-0 shrink-0 flex-col gap-3 overflow-hidden rounded-lg border p-3 transition-colors",
        (isOver || highlighted) && "bg-muted/40",
      )}
    >
      <header className="flex shrink-0 items-center justify-between text-sm">
        <span className="truncate font-medium">{label}</span>
        <span className="text-muted-foreground text-xs">{cards.length}</span>
      </header>
      <div className={cn("min-h-0 min-w-0 flex-1 border-l-2 pl-3", accent)}>
        <div
          data-testid={`pipeline-column-list-${stage}`}
          className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto pr-1"
        >
          {cards.length === 0 ? (
            <p className="text-muted-foreground text-xs italic">Sem leads</p>
          ) : (
            cards.map((card) => <Card key={card.id} card={card} />)
          )}
        </div>
      </div>
    </section>
  );
}

function Card({ card }: { card: PipelineCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: card.id });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;
  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "border-border bg-background hover:bg-muted/50 min-w-0 cursor-grab rounded-md border p-3 text-sm shadow-sm transition-colors",
        isDragging && "opacity-50",
      )}
    >
      <p className="font-medium">{card.name}</p>
      {card.category ? (
        <p className="text-muted-foreground mt-0.5 text-xs">
          {card.category}
        </p>
      ) : null}
      {card.city || card.state ? (
        <p className="text-muted-foreground mt-0.5 text-xs">
          {[card.city, card.state].filter(Boolean).join(" / ")}
        </p>
      ) : null}
      <p className="text-foreground mt-2 text-xs font-medium">
        Score {card.score}
      </p>
    </article>
  );
}
