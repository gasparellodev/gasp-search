// Sem `server-only`: helper puro, sem secrets. Pode ser usado tanto no
// server (envio do site preview via Evolution) quanto no client (preview
// no UI antes do disparo). Espelha a separação que `lib/evolution/templates.ts`
// faz para campanhas — mas com sintaxe `{key}` (single-brace) e contrato
// estrito (lança em variável faltante) específicos do fluxo de Site Generator.

// Casa apenas identificadores snake/camel-case dentro de chaves simples.
// Sem suporte a `{{key}}` (esse é o estilo de campanhas, em
// `lib/evolution/templates.ts`) nem a aninhamento.
const PLACEHOLDER_REGEX = /\{(\w+)\}/g;

/**
 * Substitui placeholders `{key}` no template pelos valores em `vars`.
 *
 * Contrato V1 — Phase 7 / Site Generator:
 * - Lança `Error('Missing template variable: <key>')` se um placeholder não
 *   tem entrada correspondente em `vars`. Isso é defensivo: o caller
 *   (sendLeadSiteWhatsApp em #171) sempre conhece o conjunto de variáveis
 *   declarado em `TEMPLATE_VARIABLES`. Faltar variável é bug, não input.
 * - Aceita valor vazio (`""`) como substituição válida — não lança.
 * - Idempotente em texto plano (sem placeholders) e em templates já
 *   renderizados.
 * - Não interpreta padrões de `String.replace` ($1, $&, etc.) nos valores —
 *   usa função de replacement, então `$` em URLs é seguro.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(PLACEHOLDER_REGEX, (_match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) {
      throw new Error(`Missing template variable: ${key}`);
    }
    return vars[key] ?? "";
  });
}
