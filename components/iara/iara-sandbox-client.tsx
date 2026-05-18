"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IaraApprovalDialog } from "@/components/iara/iara-approval-dialog";
import { IaraChatBubble } from "@/components/iara/iara-chat-bubble";
import { IaraConversationMeta } from "@/components/iara/iara-conversation-meta";
import {
  HANDOFF_ICON,
  HANDOFF_LABEL,
  type IaraApprovalStatus,
  type IaraChatMessage,
  type IaraConversationDetail,
  type IaraHandoffPriority,
} from "@/components/iara/types";

const FOUNDER_CONFIG_KEY = "iara:founder-config:v1";

interface FounderConfig {
  founderName: string;
  founderDescricao: string;
}

const DEFAULT_FOUNDER_CONFIG: FounderConfig = {
  founderName: "Vinicius",
  founderDescricao: "",
};

function readFounderConfig(): FounderConfig {
  if (typeof window === "undefined") return DEFAULT_FOUNDER_CONFIG;
  try {
    const raw = window.localStorage.getItem(FOUNDER_CONFIG_KEY);
    if (!raw) return DEFAULT_FOUNDER_CONFIG;
    const parsed = JSON.parse(raw) as Partial<FounderConfig>;
    return {
      founderName:
        typeof parsed.founderName === "string" && parsed.founderName.trim()
          ? parsed.founderName
          : DEFAULT_FOUNDER_CONFIG.founderName,
      founderDescricao:
        typeof parsed.founderDescricao === "string"
          ? parsed.founderDescricao
          : "",
    };
  } catch {
    return DEFAULT_FOUNDER_CONFIG;
  }
}

function writeFounderConfig(cfg: FounderConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FOUNDER_CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    // localStorage indisponível (private mode, quota) — silencioso.
  }
}

interface PostResponse {
  conversationId: string;
  assistantMessage: string;
  toolCalls: unknown[];
  handoff: { priority: string; motivo: string } | null;
}

interface IaraSandboxClientProps {
  leadId: string;
  initialDetail: IaraConversationDetail | null;
}

export function IaraSandboxClient({
  leadId,
  initialDetail,
}: IaraSandboxClientProps) {
  const [detail, setDetail] = useState<IaraConversationDetail | null>(
    initialDetail,
  );
  const [inputValue, setInputValue] = useState("");
  const [busy, setBusy] = useState(false);
  // `useState(fn)` lazily lê localStorage só uma vez no mount — evita
  // SSR mismatch (server retorna DEFAULT, client troca no primeiro render).
  // Em test (jsdom) localStorage existe e o helper devolve DEFAULT se vazio,
  // então o hydration mismatch só apareceria com config persistida — Phase 1
  // sandbox é client-only (parent é Server Component, mas este filho é
  // 'use client' e nunca SSR-rendered).
  const [founderCfg, setFounderCfg] = useState<FounderConfig>(() =>
    readFounderConfig(),
  );
  const [pendingDecision, setPendingDecision] = useState<
    Exclude<IaraApprovalStatus, "pending"> | null
  >(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Sempre desce o scroll ao mudar mensagens.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [detail?.messages?.length, busy]);

  // Re-fetch detail (post-send / post-reset).
  const refreshDetail = useCallback(
    async (conversationId: string) => {
      try {
        const res = await fetch(
          `/api/iara/sandbox/conversation/${conversationId}`,
        );
        if (!res.ok) return;
        const body = (await res.json()) as Partial<IaraConversationDetail>;
        // Defensive shape check — só substitui o detail se o payload bate
        // com o contrato do GET /conversation/[id]. Evita corromper o estado
        // se um endpoint diferente for chamado por engano (e mantém o test
        // de POST resiliente quando ele compartilha o mesmo mock fetch).
        if (
          body &&
          typeof body === "object" &&
          body.conversation &&
          body.lead &&
          Array.isArray(body.messages) &&
          Array.isArray(body.handoffs)
        ) {
          setDetail(body as IaraConversationDetail);
        }
      } catch {
        // best-effort — usuário pode recarregar manualmente.
      }
    },
    [],
  );

  const handleFounderConfigChange = useCallback(
    (name: string, descricao: string) => {
      const next: FounderConfig = {
        founderName: name.trim() || DEFAULT_FOUNDER_CONFIG.founderName,
        founderDescricao: descricao.trim(),
      };
      setFounderCfg(next);
      writeFounderConfig(next);
    },
    [],
  );

  async function handleSend() {
    const text = inputValue.trim();
    if (!text || busy) return;

    setBusy(true);
    setInputValue("");

    const optimisticUser: IaraChatMessage = {
      role: "user",
      content: text,
      toolCalls: null,
    };
    setDetail((prev) => {
      if (!prev) {
        return {
          conversation: {
            id: "optimistic",
            leadId,
            iaraVersion: "1.1",
            isSandbox: true,
            lastMessageAt: new Date().toISOString(),
            approvalStatus: "pending",
            approvalNotes: null,
            reviewedAt: null,
            createdAt: new Date().toISOString(),
          },
          lead: {
            id: leadId,
            business_name: "Lead",
            city: null,
            status: "new",
          },
          messages: [optimisticUser],
          handoffs: [],
        };
      }
      return { ...prev, messages: [...prev.messages, optimisticUser] };
    });

    try {
      const payload: Record<string, unknown> = {
        leadId,
        userMessage: text,
        founderName: founderCfg.founderName,
      };
      if (founderCfg.founderDescricao.trim()) {
        payload.founderDescricao = founderCfg.founderDescricao.trim();
      }

      const res = await fetch("/api/iara/sandbox/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as PostResponse | { error?: string };
      if (!res.ok) {
        const errMsg = "error" in body ? body.error : "Falha desconhecida";
        throw new Error(errMsg ?? "Falha desconhecida");
      }
      const success = body as PostResponse;
      await refreshDetail(success.conversationId);
      if (success.handoff) {
        toast.info(
          `Iara escalou ${success.handoff.priority}: ${success.handoff.motivo}`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!detail) return;
    const ok = window.confirm(
      "Resetar a conversa? Mensagens e handoffs serão apagados.",
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/iara/sandbox/conversation/${detail.conversation.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Falha ao resetar conversa");
      }
      setDetail(null);
      toast.success("Conversa resetada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao resetar");
    } finally {
      setBusy(false);
    }
  }

  async function submitDecision(
    status: Exclude<IaraApprovalStatus, "pending">,
    notes: string | null,
  ) {
    if (!detail) return;
    try {
      const res = await fetch(
        `/api/iara/sandbox/conversation/${detail.conversation.id}/review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            approvalStatus: status,
            approvalNotes: notes,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Falha ao salvar veredito");
      }
      toast.success(
        status === "approved" ? "Conversa aprovada" : "Conversa reprovada",
      );
      await refreshDetail(detail.conversation.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    }
  }

  // Cálculo do "último handoff por turno" — relaciona handoffs com a
  // ÚLTIMA mensagem assistant que contém tool_calls.escalar_para_humano.
  // Em Fase 1 simplificamos: associamos cada handoff (ordem cronológica)
  // à mensagem assistant correspondente sequencialmente.
  const handoffByMessageIdx = useMemo(() => {
    const map = new Map<number, IaraHandoffEntryShort>();
    if (!detail) return map;
    const handoffs = Array.isArray(detail.handoffs) ? detail.handoffs : [];
    const messages = Array.isArray(detail.messages) ? detail.messages : [];
    const sortedHandoffs = [...handoffs].sort((a, b) =>
      a.createdAt < b.createdAt ? -1 : 1,
    );
    let handoffIdx = 0;
    messages.forEach((msg, idx) => {
      if (msg.role !== "assistant") return;
      const calls = Array.isArray(msg.toolCalls) ? msg.toolCalls : [];
      const hasEscalate = calls.some((c) => {
        if (c && typeof c === "object") {
          const rec = c as Record<string, unknown>;
          return rec.tool === "escalar_para_humano";
        }
        return false;
      });
      if (hasEscalate && handoffIdx < sortedHandoffs.length) {
        const handoff = sortedHandoffs[handoffIdx]!;
        map.set(idx, {
          priority: handoff.priority,
          motivo: handoff.motivo,
        });
        handoffIdx += 1;
      }
    });
    return map;
  }, [detail]);

  const latestHandoffBadge =
    detail && Array.isArray(detail.handoffs) && detail.handoffs[0]
      ? detail.handoffs[0]
      : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col md:flex-row">
      <section
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
        aria-label="Chat com a Iara"
      >
        <header className="bg-background sticky top-0 z-10 flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-full">
              <Sparkles className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                {detail?.lead.business_name ?? "Sandbox da Iara"}
              </div>
              <div className="text-muted-foreground text-xs">
                {detail?.lead.city ?? "Selecione um lead pra começar"}
              </div>
            </div>
            <Badge variant="outline" className="font-mono">
              Iara {detail?.conversation.iaraVersion ?? "1.1"}
            </Badge>
            {latestHandoffBadge ? (
              <Badge
                variant={
                  latestHandoffBadge.priority === "P0"
                    ? "destructive"
                    : "secondary"
                }
                title={HANDOFF_LABEL[latestHandoffBadge.priority]}
              >
                <span aria-hidden="true" className="mr-1">
                  {HANDOFF_ICON[latestHandoffBadge.priority]}
                </span>
                {latestHandoffBadge.priority}
              </Badge>
            ) : null}
          </div>
        </header>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
          aria-live="polite"
        >
          {detail &&
          Array.isArray(detail.messages) &&
          detail.messages.length > 0 ? (
            detail.messages.map((msg, idx) => (
              <IaraChatBubble
                key={`${idx}-${msg.role}`}
                message={msg}
                inlineHandoff={handoffByMessageIdx.get(idx) ?? null}
              />
            ))
          ) : (
            <div className="text-muted-foreground mx-auto max-w-md rounded-md border border-dashed p-6 text-center text-sm">
              <p className="mb-1 font-medium text-foreground">
                Sem mensagens ainda
              </p>
              <p>
                Envie uma mensagem como se fosse o lojista. A Iara vai
                responder no estilo configurado e logar os tool_calls.
              </p>
            </div>
          )}
        </div>

        <footer className="bg-background sticky bottom-0 border-t px-4 py-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Digite como se fosse o lojista..."
              rows={2}
              maxLength={2000}
              aria-label="Mensagem como lojista"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              disabled={busy}
              className="min-h-[44px] flex-1 resize-none"
            />
            <Button
              onClick={() => void handleSend()}
              disabled={busy || !inputValue.trim()}
              aria-label="Enviar como lojista"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              <span className="ml-1.5">Enviar</span>
            </Button>
          </div>
          {busy ? (
            <p className="text-muted-foreground mt-1 text-xs">
              Iara está pensando...
            </p>
          ) : null}
        </footer>
      </section>

      <div className="w-full shrink-0 md:w-80">
        <IaraConversationMeta
          detail={detail}
          founderName={founderCfg.founderName}
          founderDescricao={founderCfg.founderDescricao}
          onFounderConfigChange={handleFounderConfigChange}
          onReset={() => void handleReset()}
          onApprove={() => setPendingDecision("approved")}
          onReject={() => setPendingDecision("rejected")}
          busy={busy}
        />
      </div>

      {pendingDecision ? (
        <IaraApprovalDialog
          open={Boolean(pendingDecision)}
          onOpenChange={(open) => {
            if (!open) setPendingDecision(null);
          }}
          decision={pendingDecision}
          defaultNotes={detail?.conversation.approvalNotes ?? ""}
          onConfirm={async (notes) => {
            await submitDecision(pendingDecision, notes);
          }}
        />
      ) : null}
    </div>
  );
}

interface IaraHandoffEntryShort {
  priority: IaraHandoffPriority;
  motivo: string;
}

export default IaraSandboxClient;
