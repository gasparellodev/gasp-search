// Templates de mensagem WhatsApp para o fluxo Site Generator (Phase 7).
//
// V1: constantes hard-coded, sem persistência. Cada template declara sua
// lista de variáveis em uma const `as const` para que o caller saiba o
// shape exato esperado por `renderTemplate`. V2 follow-up: per-user
// customizable templates (DB-backed).
//
// Sintaxe: `{key}` (single-brace). Renderizado por
// `lib/whatsapp/render-template.ts`. Não confundir com `{{key}}` em
// `lib/evolution/templates.ts` (campanhas modo `template`).

export const SITE_PREVIEW_TEMPLATE = `Oi {business_name}! Gerei uma prévia do site da sua concessionária pra você dar uma olhada:

{site_url}

Se gostar, posso publicar e ajustar o que for necessário. Qualquer dúvida me chama!`;

/**
 * Variáveis declaradas pelo `SITE_PREVIEW_TEMPLATE`. O caller deve
 * fornecer todas — `renderTemplate` lança em variável faltante.
 */
export const TEMPLATE_VARIABLES = ["business_name", "site_url"] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];
