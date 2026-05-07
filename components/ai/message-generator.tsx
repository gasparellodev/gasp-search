"use client";

import { useState } from "react";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_MESSAGE_CHANNELS,
  AI_MESSAGE_TONES,
  type AiMessageChannel,
  type AiMessageTone,
} from "@/lib/validators/ai";

interface MessageGeneratorProps {
  leadId: string;
}

const CHANNEL_LABEL: Record<AiMessageChannel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

const TONE_LABEL: Record<AiMessageTone, string> = {
  consultivo: "Consultivo",
  direto: "Direto",
  amigavel: "Amigável",
  formal: "Formal",
};

function getErrorMessage(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return "Tente novamente em instantes";
}

export function MessageGenerator({ leadId }: MessageGeneratorProps) {
  const [channel, setChannel] = useState<AiMessageChannel>("whatsapp");
  const [tone, setTone] = useState<AiMessageTone>("consultivo");
  const [goal, setGoal] = useState("iniciar uma conversa comercial");
  const [content, setContent] = useState("");
  const [hasResult, setHasResult] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/ai/generate-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId, channel, tone, goal: goal.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as unknown;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload));
      }
      if (
        !payload ||
        typeof payload !== "object" ||
        !("content" in payload) ||
        typeof payload.content !== "string"
      ) {
        throw new Error("Resposta inválida");
      }

      setContent(payload.content);
      setHasResult(true);
      toast.success("Mensagem gerada");
    } catch (error) {
      toast.error("Geração falhou", {
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes",
      });
    } finally {
      setLoading(false);
    }
  }

  async function copyMessage() {
    if (!content.trim()) return;
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mensagem IA</CardTitle>
        <CardDescription>
          Gere uma abordagem inicial personalizada para este lead.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label
              htmlFor="ai-channel"
              className="text-muted-foreground text-xs font-medium uppercase"
            >
              Canal
            </label>
            <select
              id="ai-channel"
              aria-label="Canal"
              value={channel}
              onChange={(event) =>
                setChannel(event.target.value as AiMessageChannel)
              }
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            >
              {AI_MESSAGE_CHANNELS.map((item) => (
                <option key={item} value={item}>
                  {CHANNEL_LABEL[item]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="ai-tone"
              className="text-muted-foreground text-xs font-medium uppercase"
            >
              Tom
            </label>
            <select
              id="ai-tone"
              aria-label="Tom"
              value={tone}
              onChange={(event) =>
                setTone(event.target.value as AiMessageTone)
              }
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            >
              {AI_MESSAGE_TONES.map((item) => (
                <option key={item} value={item}>
                  {TONE_LABEL[item]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label
              htmlFor="ai-goal"
              className="text-muted-foreground text-xs font-medium uppercase"
            >
              Objetivo
            </label>
            <Textarea
              id="ai-goal"
              aria-label="Objetivo"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              rows={3}
            />
          </div>

          <div className="md:col-span-2">
            <Button type="submit" disabled={loading} className="min-w-32">
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              {loading ? "Gerando" : "Gerar"}
            </Button>
          </div>
        </form>

        {hasResult ? (
          <div className="border-border rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Resultado</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyMessage}
              >
                <Copy className="size-4" aria-hidden="true" />
                Copiar
              </Button>
            </div>
            <Textarea
              aria-label="Mensagem gerada"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={7}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
