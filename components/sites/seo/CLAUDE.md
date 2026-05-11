# `components/sites/seo/` — Componentes SEO Server-only do Site Generator

## Propósito

Componentes Server-only que injetam metadata SEO secundário (JSON-LD,
preload hints futuros) no DOM dos sites públicos `/sites/<slug>/*`.

Diferente de `lib/sites/metadata.ts` (que produz `Metadata` consumido
pelo Next App Router pra `<head>`), estes componentes renderizam tags
HTML diretamente no `<body>` via React tree — apropriado para JSON-LD
que vai em `<script>` sem precisar de `next/head`.

## Como adicionar

- 1 arquivo por componente, em PascalCase (ex: `SiteSchema.tsx`).
- **Server Component sempre.** Sem state/handlers. Sem `'use client'`.
- **`import "server-only"`** no topo — defesa em profundidade contra
  bundling acidental em Client Components.
- Componentes que recebem dados crus do DB devem assumir que o caller
  já validou via Zod (`readSiteVariablesSafe`).

## Regras de negócio

1. **`dangerouslySetInnerHTML` é permitido aqui** mas SEMPRE com escape
   defensivo. Padrão obrigatório:
   - `</script>` (qualquer case) → `<\/script>`.
   - `U+2028` / `U+2029` → ` ` / ` ` (escape sequence).
   - JSON-LD nunca vai cru de `JSON.stringify` direto pro DOM.
2. **Schemas SEMPRE injetados** — independente de `isIndexable(site)`.
   AI crawlers (ChatGPT/Perplexity/Claude/Gemini) consomem JSON-LD
   independente de `robots:noindex`. Sites demo/preview ainda se
   beneficiam de citação em AI Overviews (moat técnico Phase 7).
3. **Fonte do schema é `lib/sites/schema.ts`** — builders puros.
   Componentes daqui apenas serializam (não calculam).

## Arquivos

| Path | Propósito |
|---|---|
| `SiteSchema.tsx` | **Server Component (issue #211 / Sprint 1).** Renderiza 1+ `<script type="application/ld+json">` com escape `</script>` + U+2028/U+2029. Aceita `schemas: JsonLdNode \| JsonLdNode[]`. Single object (incluindo `{@context, @graph}`) vira 1 script; array vira N scripts. Não desempacota `@graph` automaticamente — caller usa `buildSitewideGraph` em `lib/sites/schema.ts` quando quer consolidar. |

## Defesa em camadas (XSS)

```
[ DB lead_sites.variables: Json ]
            ↓
[ readSiteVariablesSafe (Zod) ]  ← validação shape + tipo
            ↓
[ buildXSchema (pure builders) ]  ← lib/sites/schema.ts
            ↓
[ SiteSchema component ]
   ↓
   JSON.stringify
   ↓
   .replace(/<\/script/gi, "<\\/script")
   .replace(/ /g, "\\u2028")
   .replace(/ /g, "\\u2029")
            ↓
[ dangerouslySetInnerHTML ]
```

## Dependências

- `react` (Server Component).
- `@/lib/sites/schema` — builders puros (mesma issue #211).
- `@/lib/env` — `NEXT_PUBLIC_APP_URL` pra URLs absolutas (lido pelos
  builders, não pelo component).

## Quando atualizar este `CLAUDE.md`

- Novo componente SEO (preload hints, `<link rel=alternate>`, etc).
- Mudança no contrato de `<SiteSchema>` (nova prop, novo formato).
- Mudança no padrão de escape (e.g., adicionar guard contra
  `<!--`/`-->` no future).
