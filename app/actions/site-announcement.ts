"use server";

/**
 * Server Action de submit do `AnnounceForm` (Phase 7 — issue #163).
 *
 * MVP V1: stub que **valida o payload e retorna `{ ok: true }`**. Não
 * persiste em `lead_announcements` (tabela ainda não existe; uma issue
 * follow-up criará a migration + integrará Evolution para notificar o
 * dono do site no WhatsApp).
 *
 * Manter o stub aqui — em vez de no client — preserva a fronteira
 * Client/Server: o componente `AnnounceForm` chama esta action por
 * referência, o que torna trivial trocar a implementação sem mexer na
 * UI.
 *
 * Padrão alinhado com `submitSiteForm` (#161): retorno discriminated
 * union `{ ok: true } \| { ok: false; error: string }`. Sem PII em
 * logs (defesa contra leak via observabilidade).
 */

import "server-only";

import {
  AnnouncementSchema,
  type AnnouncementInput,
} from "@/lib/sites/announcement.schema";

export type SubmitAnnouncementResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitAnnouncement(
  siteId: string,
  payload: AnnouncementInput,
): Promise<SubmitAnnouncementResult> {
  if (typeof siteId !== "string" || siteId.length === 0) {
    return { ok: false, error: "siteId inválido" };
  }

  const parsed = AnnouncementSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Payload inválido",
    };
  }

  // MVP V1: a persistência ficará para issue follow-up. Não logamos PII
  // aqui — `nome`, `telefone`, `email`, `mensagem` saem do escopo de
  // observabilidade pra evitar leak via aggregator de logs.
  return { ok: true };
}
