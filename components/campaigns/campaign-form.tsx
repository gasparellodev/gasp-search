"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_MESSAGE_CHANNELS,
  AI_MESSAGE_TONES,
  type AiMessageChannel,
  type AiMessageTone,
} from "@/lib/validators/ai";
import { CAMPAIGN_MAX_LEADS } from "@/lib/validators/campaigns";
import {
  SUPPORTED_PLACEHOLDERS,
  renderTemplate,
  validateTemplate,
} from "@/lib/evolution/templates";
import type { LeadForMessage } from "@/lib/ai/anthropic";

type Mode = "template" | "ai_per_lead";

type Props = {
  selectedLeads: Array<LeadForMessage & { id: string }>;
};

export function CampaignForm({ selectedLeads }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("template");
  const [templateText, setTemplateText] = useState(
    "Olá {{nome}}, vi seu negócio em {{cidade}} e tenho uma proposta...",
  );
  const [aiChannel, setAiChannel] = useState<AiMessageChannel>("whatsapp");
  const [aiTone, setAiTone] = useState<AiMessageTone>("consultivo");
  const [aiGoal, setAiGoal] = useState("iniciar uma conversa comercial");
  const [busy, setBusy] = useState(false);

  const validation = useMemo(
    () => (mode === "template" ? validateTemplate(templateText) : null),
    [mode, templateText],
  );

  const preview = useMemo(() => {
    if (mode !== "template") return null;
    const first = selectedLeads[0];
    if (!first) return null;
    return renderTemplate(templateText, first);
  }, [mode, selectedLeads, templateText]);

  const overLimit = selectedLeads.length > CAMPAIGN_MAX_LEADS;
  const noLeads = selectedLeads.length === 0;
  const invalidTemplate =
    mode === "template" && (!templateText.trim() || !validation?.valid);
  const invalidAi =
    mode === "ai_per_lead" && (!aiChannel || !aiTone);
  const disabled =
    busy || !name.trim() || noLeads || overLimit || invalidTemplate || invalidAi;

  const submit = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      const body =
        mode === "template"
          ? {
              name: name.trim(),
              mode: "template" as const,
              templateText,
              leadIds: selectedLeads.map((l) => l.id),
            }
          : {
              name: name.trim(),
              mode: "ai_per_lead" as const,
              aiChannel,
              aiTone,
              aiGoal: aiGoal || undefined,
              leadIds: selectedLeads.map((l) => l.id),
            };
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? "Falha ao criar campanha");
      }
      const json = (await res.json()) as { campaignId: string };
      toast.success("Campanha disparada");
      router.push(`/campaigns/${json.campaignId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar campanha");
      setBusy(false);
    }
  };

  return (
    <Card data-testid="campaign-form">
      <CardHeader>
        <CardTitle>Nova campanha</CardTitle>
        <CardDescription>
          {selectedLeads.length} lead(s) selecionado(s)
          {overLimit ? ` — máximo ${CAMPAIGN_MAX_LEADS}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="campaign-name">Nome</Label>
          <Input
            id="campaign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Black Friday 2026 — barbearias SP"
          />
        </div>

        <div className="grid gap-2">
          <Label>Modo</Label>
          <div className="flex gap-2" role="radiogroup">
            <Button
              type="button"
              variant={mode === "template" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("template")}
              role="radio"
              aria-checked={mode === "template"}
            >
              Template
            </Button>
            <Button
              type="button"
              variant={mode === "ai_per_lead" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("ai_per_lead")}
              role="radio"
              aria-checked={mode === "ai_per_lead"}
            >
              IA por lead
            </Button>
          </div>
        </div>

        {mode === "template" ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="campaign-template">Template</Label>
              <Textarea
                id="campaign-template"
                value={templateText}
                onChange={(e) => setTemplateText(e.target.value)}
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Placeholders suportados:{" "}
                {SUPPORTED_PLACEHOLDERS.map((p) => `{{${p}}}`).join(", ")}
              </p>
              {validation && !validation.valid && (
                <p className="text-xs text-destructive">
                  Placeholders desconhecidos:{" "}
                  {validation.unknownPlaceholders.join(", ")}
                </p>
              )}
            </div>
            {preview && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                  Preview com {selectedLeads[0]?.name}
                </p>
                <p className="whitespace-pre-wrap">{preview}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid gap-2">
              <Label>Canal</Label>
              <Select
                value={aiChannel}
                onValueChange={(v) => setAiChannel(v as AiMessageChannel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_MESSAGE_CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Tom</Label>
              <Select
                value={aiTone}
                onValueChange={(v) => setAiTone(v as AiMessageTone)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_MESSAGE_TONES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="campaign-goal">Objetivo</Label>
              <Textarea
                id="campaign-goal"
                value={aiGoal}
                onChange={(e) => setAiGoal(e.target.value)}
                rows={3}
              />
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button onClick={submit} disabled={disabled}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Disparar campanha
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
