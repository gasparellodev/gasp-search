"use client";

import { useState } from "react";
import { Bot, ChevronDown, ChevronUp, User, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  HANDOFF_ICON,
  HANDOFF_LABEL,
  type IaraChatMessage,
  type IaraHandoffPriority,
} from "@/components/iara/types";

interface IaraChatBubbleProps {
  message: IaraChatMessage;
  /**
   * Handoff registrado por este turno do assistant (resultado do
   * `escalar_para_humano`). Mostrado como banner colorido inline.
   */
  inlineHandoff?: {
    priority: IaraHandoffPriority;
    motivo: string;
  } | null;
}

function formatToolInput(input: unknown): string {
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

function summarizeToolCall(call: unknown): {
  tool: string;
  inputSummary: string;
} {
  if (call && typeof call === "object") {
    const record = call as Record<string, unknown>;
    const tool = typeof record.tool === "string" ? record.tool : "tool";
    const input = record.input;
    let summary = "";
    if (input && typeof input === "object") {
      const entries = Object.entries(input as Record<string, unknown>)
        .slice(0, 2)
        .map(([k, v]) => {
          const valStr =
            typeof v === "string"
              ? v.length > 40
                ? `${v.slice(0, 40)}…`
                : v
              : JSON.stringify(v);
          return `${k}=${valStr}`;
        });
      summary = entries.join(", ");
    }
    return { tool, inputSummary: summary };
  }
  return { tool: "tool", inputSummary: "" };
}

const HANDOFF_BANNER_CLS: Record<IaraHandoffPriority, string> = {
  P0: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  P1: "border-yellow-500/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200",
  P2: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  P3: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

export function IaraChatBubble({ message, inlineHandoff }: IaraChatBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const isAssistant = message.role === "assistant";
  const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : [];

  return (
    <div
      className={cn(
        "flex w-full gap-3",
        isAssistant ? "justify-start" : "justify-end",
      )}
      data-testid={`iara-bubble-${message.role}`}
    >
      {isAssistant ? (
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <Bot className="size-4" />
        </div>
      ) : null}

      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-2",
          isAssistant ? "items-start" : "items-end",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
            isAssistant
              ? "bg-muted text-foreground"
              : "bg-primary text-primary-foreground",
          )}
        >
          {message.content || (
            <span className="text-muted-foreground italic">(vazio)</span>
          )}
        </div>

        {toolCalls.length > 0 ? (
          <div className="flex w-full flex-col gap-1.5">
            {toolCalls.map((call, idx) => {
              const { tool, inputSummary } = summarizeToolCall(call);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="text-muted-foreground hover:bg-muted/50 flex items-center gap-2 self-start rounded-md border bg-background px-2 py-1 text-xs"
                  aria-label={`Toggle detalhes da tool ${tool}`}
                  aria-expanded={expanded}
                >
                  <Wrench className="size-3" aria-hidden="true" />
                  <span className="font-medium text-foreground">{tool}</span>
                  {inputSummary ? (
                    <span className="truncate">{inputSummary}</span>
                  ) : null}
                  {expanded ? (
                    <ChevronUp className="size-3" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="size-3" aria-hidden="true" />
                  )}
                </button>
              );
            })}
            {expanded ? (
              <pre className="max-h-40 overflow-auto rounded-md border bg-background px-2 py-1.5 text-xs whitespace-pre-wrap">
                {toolCalls
                  .map((c) => formatToolInput(c))
                  .join("\n\n---\n\n")}
              </pre>
            ) : null}
          </div>
        ) : null}

        {inlineHandoff ? (
          <div
            role="status"
            className={cn(
              "flex w-full items-start gap-2 rounded-md border px-3 py-2 text-xs",
              HANDOFF_BANNER_CLS[inlineHandoff.priority],
            )}
          >
            <span aria-hidden="true">
              {HANDOFF_ICON[inlineHandoff.priority]}
            </span>
            <div className="flex flex-col gap-0.5">
              <Badge variant="outline" className="self-start font-mono">
                {HANDOFF_LABEL[inlineHandoff.priority]}
              </Badge>
              <span>{inlineHandoff.motivo}</span>
            </div>
          </div>
        ) : null}
      </div>

      {!isAssistant ? (
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          <User className="size-4" />
        </div>
      ) : null}
    </div>
  );
}

export default IaraChatBubble;
