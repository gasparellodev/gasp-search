/**
 * `<SiteSchema>` — Server Component que injeta JSON-LD (Schema.org).
 *
 * Issue #211 / Sprint 1 / #S1 — moat técnico Phase 7. Pareado com
 * `lib/sites/schema.ts` (builders puros).
 *
 * **API:** `<SiteSchema schemas={...} />`. `schemas` aceita:
 *   - **Single object** (ex: `Vehicle`, `BreadcrumbList`): renderiza 1
 *     `<script type="application/ld+json">`.
 *   - **Array** (raro — preferimos `@graph` no helper): renderiza N
 *     scripts (1 por entry).
 *   - **Graph object** (`{@context, @graph: [...]}`): renderiza 1 script
 *     (treated as single object, não desempacotado).
 *
 * **XSS guard (CRÍTICO):** Substitui `</script>` → `<\/script>` ANTES do
 * `dangerouslySetInnerHTML`. Defesa em profundidade — mesmo que copy do
 * site (carregada do DB via SiteVariables.parse) contenha literal
 * `</script>`, a inserção no DOM não fecha o script tag.
 *
 * Adicionalmente, escapa `U+2028`/`U+2029` (line/paragraph separators
 * que são válidos em JSON mas quebram parser JS legacy).
 *
 * **Server Component**: sem hooks, sem `'use client'`. Pode ser
 * renderizado em layouts, pages e components Server-only.
 *
 * **Defesa em camadas:**
 *   1. Builders puros (lib/sites/schema.ts) recebem `SiteVariablesV2`
 *      validado por Zod upstream (`readSiteVariablesSafe`).
 *   2. Este componente escapa `</script>` na borda HTML.
 *   3. CSP `script-src` (V2) bloquearia execução de inline `<script>`
 *      não-allowlistado. Hoje confiamos em (1) + (2).
 */
import "server-only";

import type { ReactNode } from "react";

/**
 * Schema JSON-LD aceito. Estruturas Schema.org típicas: `{ '@context': ...,
 * '@type': ..., ... }` ou `{ '@context': ..., '@graph': [...] }`. Usamos
 * `Record<string, unknown>` na entrada pra aceitar qualquer node sem
 * forçar caller a narrowing complexo de `schema-dts`.
 */
type SchemaNode = Record<string, unknown>;

interface SiteSchemaProps {
  /**
   * Schema (object) OU array de schemas. Quando array, renderiza 1
   * `<script>` por entry. Quando object com `@graph`, renderiza 1
   * script único — tratamento `@graph` é responsabilidade do builder
   * upstream (`buildSitewideGraph`).
   */
  schemas: SchemaNode | SchemaNode[];
}

/**
 * Escapa sequências que poderiam quebrar embedding em HTML inline.
 *
 *   - `</script>` (qualquer case) → `<\/script>` (escape "/" via "\\/").
 *   - `U+2028` / `U+2029` → `\u2028` / `\u2029`.
 *
 * `JSON.stringify` JÁ escapa caracteres dentro de strings, mas os 3
 * acima são tecnicamente válidos em JSON e passam livres. Por isso
 * fazemos escape adicional no resultado serializado.
 */
function serializeForScriptTag(value: unknown): string {
  return JSON.stringify(value)
    .replace(/<\/script/gi, "<\\/script")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Renderiza 1 script tag JSON-LD para o schema dado.
 */
function ScriptNode({ schema }: { schema: SchemaNode }): ReactNode {
  // Defesa em camadas justificando `dangerouslySetInnerHTML`:
  //   1. Builders puros (lib/sites/schema.ts) recebem variables validados via
  //      `readSiteVariablesSafe` (Zod) upstream.
  //   2. `serializeForScriptTag` escapa `</script>` + U+2028/U+2029.
  //   3. (V2 — fora de escopo) CSP `script-src` no header bloquearia
  //      inline-script não-allowlistado.
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeForScriptTag(schema) }}
    />
  );
}

export function SiteSchema({ schemas }: SiteSchemaProps): ReactNode {
  if (Array.isArray(schemas)) {
    return (
      <>
        {schemas.map((schema, idx) => (
          // Index key OK: schemas array é estável dentro de 1 render
          // (caller fornece ordem fixa, sem reordenação dinâmica).
          <ScriptNode key={idx} schema={schema} />
        ))}
      </>
    );
  }
  return <ScriptNode schema={schemas} />;
}
