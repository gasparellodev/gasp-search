"use client";

import { useEffect, useState, useTransition } from "react";
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
import { toast } from "sonner";

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
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-2">
        {LEAD_STAGES.map((stage) => (
          <Column
            key={stage}
            stage={stage}
            label={STAGE_LABEL[stage]}
            accent={STAGE_ACCENT[stage]}
            cards={optimistic[stage]}
          />
        ))}
      </div>
    </DndContext>
  );
}

interface ColumnProps {
  stage: LeadStage;
  label: string;
  accent: string;
  cards: PipelineCard[];
}

function Column({ stage, label, accent, cards }: ColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: stage });
  return (
    <section
      ref={setNodeRef}
      role="region"
      aria-label={label}
      className={cn(
        "border-border bg-card flex w-72 shrink-0 flex-col gap-3 rounded-lg border p-3 transition-colors",
        isOver && "bg-muted/40",
      )}
    >
      <header className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground text-xs">{cards.length}</span>
      </header>
      <div className={cn("border-l-2 pl-3", accent)}>
        <div className="flex flex-col gap-2">
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
        "border-border bg-background hover:bg-muted/50 cursor-grab rounded-md border p-3 text-sm shadow-sm transition-colors",
        isDragging && "opacity-50",
      )}
    >
      <p className="font-medium">{card.name}</p>
      {card.category ? (
        <p className="text-muted-foreground mt-0.5 text-xs">{card.category}</p>
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
