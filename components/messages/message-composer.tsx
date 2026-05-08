"use client";

import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  leadId: string;
};

type InstanceState = { status: string };

export function MessageComposer({ leadId }: Props) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [instanceStatus, setInstanceStatus] = useState<string | null>(null);

  // Verifica status da instância pra desabilitar botão se desconectado.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/whatsapp/instance", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as InstanceState;
        if (active) setInstanceStatus(body.status);
      } catch {
        // ignora — disabled state vai cair no fallback
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const connected = instanceStatus === "connected";
  const disabled = busy || !connected || content.trim().length === 0;

  const send = async () => {
    if (disabled) return;
    const text = content.trim();
    setBusy(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId, content: text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Falha ao enviar");
      }
      setContent("");
      toast.success("Mensagem enviada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex items-end gap-2 border-t bg-background p-3"
      data-testid="message-composer"
    >
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void send();
          }
        }}
        placeholder={
          connected
            ? "Digite a mensagem (Ctrl+Enter para enviar)..."
            : "Conecte o WhatsApp em Configurações para enviar."
        }
        disabled={!connected || busy}
        rows={2}
        className="min-h-10 resize-none"
      />
      <Button
        onClick={send}
        disabled={disabled}
        size="icon"
        aria-label="Enviar mensagem"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
      </Button>
    </div>
  );
}
