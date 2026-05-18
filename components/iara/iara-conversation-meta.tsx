"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  APPROVAL_LABEL,
  HANDOFF_ICON,
  type IaraApprovalStatus,
  type IaraConversationDetail,
  type IaraHandoffPriority,
} from "@/components/iara/types";

interface IaraConversationMetaProps {
  detail: IaraConversationDetail | null;
  founderName: string;
  founderDescricao: string;
  onFounderConfigChange: (name: string, descricao: string) => void;
  onReset: () => void;
  onApprove: () => void;
  onReject: () => void;
  busy?: boolean;
}

const APPROVAL_VARIANT: Record<
  IaraApprovalStatus,
  "default" | "secondary" | "destructive"
> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

const HANDOFF_VARIANT: Record<
  IaraHandoffPriority,
  "destructive" | "default" | "secondary" | "outline"
> = {
  P0: "destructive",
  P1: "default",
  P2: "secondary",
  P3: "outline",
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function IaraConversationMeta({
  detail,
  founderName,
  founderDescricao,
  onFounderConfigChange,
  onReset,
  onApprove,
  onReject,
  busy,
}: IaraConversationMetaProps) {
  const [name, setName] = useState(founderName);
  const [desc, setDesc] = useState(founderDescricao);

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto border-l p-3"
      aria-label="Detalhes da conversa"
    >
      {detail ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Lead</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="font-medium">{detail.lead.business_name}</div>
              <div className="text-muted-foreground">
                {detail.lead.city ?? "Cidade não informada"}
              </div>
              <div>
                <Badge variant="outline" className="font-mono">
                  pipeline: {detail.lead.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mensagens</span>
                <span className="font-mono">{detail.messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Handoffs</span>
                <span className="font-mono">{detail.handoffs.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criada</span>
                <span className="font-mono">
                  {formatDateTime(detail.conversation.createdAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Último update</span>
                <span className="font-mono">
                  {formatDateTime(detail.conversation.lastMessageAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Iara version</span>
                <Badge variant="outline" className="font-mono">
                  {detail.conversation.iaraVersion}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aprovação</span>
                <Badge
                  variant={
                    APPROVAL_VARIANT[detail.conversation.approvalStatus]
                  }
                >
                  {APPROVAL_LABEL[detail.conversation.approvalStatus]}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Handoffs</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.handoffs.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nenhum handoff registrado.
                </p>
              ) : (
                <ul className="space-y-2">
                  {detail.handoffs.map((h, idx) => (
                    <li key={idx} className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span aria-hidden="true">{HANDOFF_ICON[h.priority]}</span>
                        <Badge variant={HANDOFF_VARIANT[h.priority]}>
                          {h.priority}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {formatDateTime(h.createdAt)}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs">{h.motivo}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="default"
              onClick={onApprove}
              disabled={busy}
              aria-label="Aprovar conversa"
            >
              Aprovar
            </Button>
            <Button
              variant="destructive"
              onClick={onReject}
              disabled={busy}
              aria-label="Reprovar conversa"
            >
              Reprovar
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={onReset}
            disabled={busy}
            aria-label="Resetar conversa"
          >
            Resetar conversa
          </Button>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Config Iara</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="space-y-1">
            <Label htmlFor="founder-name">Founder name</Label>
            <Input
              id="founder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => onFounderConfigChange(name, desc)}
              placeholder="Vinicius"
              maxLength={40}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="founder-desc">Founder descrição (opcional)</Label>
            <Textarea
              id="founder-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={() => onFounderConfigChange(name, desc)}
              placeholder="Ex: ex-consultor automotivo com 8 anos de mercado."
              rows={3}
              maxLength={400}
            />
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}

export default IaraConversationMeta;
