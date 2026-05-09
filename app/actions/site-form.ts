"use server";

/**
 * Server Action de submit do `SiteForm` (Phase 7 — issue #161).
 *
 * MVP: stub que **valida o payload e retorna `{ success: true }`**. Não
 * persiste em `site_form_submissions` (tabela ainda não existe; uma issue
 * follow-up criará a migration + integrará Evolution para notificar o
 * dono do site no WhatsApp).
 *
 * Manter o stub aqui — em vez de no client — preserva a fronteira
 * Client/Server: o componente `SiteForm` chama esta action por referência,
 * o que torna trivial trocar a implementação sem mexer na UI.
 */

import { SiteFormSchema, type SiteFormInput } from "@/lib/sites/site-form.schema";

export type SubmitSiteFormResult =
  | { success: true }
  | { success: false; error: string };

export async function submitSiteForm(
  siteId: string,
  payload: SiteFormInput,
): Promise<SubmitSiteFormResult> {
  if (typeof siteId !== "string" || siteId.length === 0) {
    return { success: false, error: "siteId inválido" };
  }

  const parsed = SiteFormSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Payload inválido",
    };
  }

  // MVP: a persistência ficará para issue follow-up. Não logamos PII aqui
  // (defesa contra leak via observabilidade).
  return { success: true };
}
