# `lib/sites/schema/` — JSON-LD Schema.org helpers

## Propósito

Builders puros que produzem JSON-LD válido para injeção via
`<script type="application/ld+json">` server-rendered nas rotas
`/sites/<slug>/*`.

> Referência de produto: `docs/SEO-PLAN.md` → seção "Schema.org JSON-LD".

## Arquivos

| Path | Propósito |
|---|---|
| `index.ts` | Barrel + helpers de defesa: `escapeJsonLd(value)` (Unicode escapes), `safeAbsoluteUrl(input)` (whitelist http/https). 7 builders Schema.org: `buildLocalBusinessSchema`, `buildAutoDealerSchema`, `buildOrganizationSchema`, `buildWebSiteSchema`, `buildVehicleSchema`, `buildBreadcrumbSchema`, `buildSitewideGraph`. |

## Helpers de defesa

### `escapeJsonLd(value)`

Chamado SEMPRE antes de `dangerouslySetInnerHTML` ao injetar JSON-LD.

Usa Unicode escapes (`<` / `>` / `&`) que mantêm o JSON
válido para `JSON.parse` enquanto bloqueiam breakout `</script>`,
comentários HTML (`<!--` / `-->`) e injeção via `&amp;`.

Padrão idêntico ao usado por Next.js internamente para `<script>` JSON.
**Nenhum builder deve produzir string que bypasse esse helper.**

### `safeAbsoluteUrl(input)`

Retorna URL absoluto (whitelist `http:`/`https:`) ou `null` para inputs
inválidos ou schemes perigosos (`javascript:`, `data:`, `file:`,
`vbscript:`, etc.).

Caller deve usar em **todos** os campos de imagem e URL externo antes de
injetar no schema. Retorno `null` → key omitida no objeto (não emitir
string vazia no JSON-LD).

## Builders disponíveis

| Função | Schema.org type | Notas |
|---|---|---|
| `buildLocalBusinessSchema` | `LocalBusiness` | Base; estendida por `AutoDealer` |
| `buildAutoDealerSchema` | `AutoDealer` | `priceRange` calculado de `min/max(cars[].price)`; omitido quando `cars.length === 0` |
| `buildOrganizationSchema` | `Organization` | `sameAs` omitido quando todas as social URLs são null |
| `buildWebSiteSchema` | `WebSite` | `publisher: { @id: #org }`; `inLanguage: 'pt-BR'`; sem `SearchAction` V1 |
| `buildVehicleSchema` | `Vehicle` | `itemCondition: UsedCondition` fixo; `priceCurrency: 'BRL'` fixo; `image` array completo ou fallback `thumbnail_url` |
| `buildBreadcrumbSchema` | `BreadcrumbList` | Items indexados a partir de 1 per spec |
| `buildSitewideGraph` | `@graph` | Consolida 4 nodes em ordem fixa: `dealer → website → org → localbusiness`; linking via `@id` com fragments (`#dealer`, `#website`, `#org`, `#localbusiness`) |

## Pattern para adicionar novo builder

1. Criar `lib/sites/schema/<name>.ts` (ou adicionar a `index.ts` se pequeno)
2. Exportar função `build<Name>Schema(input): JsonLdNode`
3. Usar `safeAbsoluteUrl` em todos os campos URL
4. Usar `escapeJsonLd` no caller ao serializar (`JSON.stringify` + escape)
5. Teste unitário em `tests/unit/lib/sites/schema/` com:
   - Estrutura completa (todos os campos presentes)
   - Campos opcionais omitidos quando ausentes
   - URLs absolutas via `safeAbsoluteUrl` (não strings brutas)
6. Injetar via `<SiteSchema schemas={[mySchema]} />` (ou adicionar ao
   `buildSitewideGraph` se for sitewide)
7. Validar com Google Rich Results Test após deploy preview

## Onde injetar

- **Sitewide** (LocalBusiness + AutoDealer + WebSite + Organization):
  `app/sites/[slug]/layout.tsx` via `<SiteSchema>` com `buildSitewideGraph`.
  Injetado mesmo em `noindex` — AI crawlers (GPTBot, ClaudeBot, PerplexityBot,
  Gemini) consomem JSON-LD ignorando `robots:noindex`.

- **Por página** (Vehicle + BreadcrumbList):
  `app/sites/[slug]/estoque/[carSlug]/page.tsx` via
  `<SiteSchema schemas={[vehicleSchema, breadcrumbSchema]}>`.

## Anti-pattern intencional

**`FAQPage` JSON-LD — não fazer em business sites.**

Google penaliza FAQPage em business sites desde 2023. `<HomeFAQSection>`
e `<DetailFaqVehicle>` renderizam FAQ visual (Radix Accordion) sem markup
JSON-LD `FAQPage`. Documentado também em:
- `lib/sites/faq-template.ts`
- `lib/sites/detail-faq-templates.ts`
- `docs/SEO-PLAN.md` → "Decisões estratégicas permanentes"

Toda nova superfície de FAQ deve respeitar essa decisão. Mudança exige
PO sign-off explícito.

## Validação manual

- Google Rich Results Test: https://search.google.com/test/rich-results
- Schema.org Validator: https://validator.schema.org/

Rodar após qualquer mudança em builder ou em ponto de injeção.
Testes automatizados (`tests/unit/lib/sites/schema.test.ts` — 44 casos)
cobrem estrutura, mas não validam contra as regras do Google Rich Results.

## Dependências

- `@/lib/env` — `NEXT_PUBLIC_APP_URL` para URLs absolutas e `@id` fragments
- `@/types/lead-site` — `SiteVariablesV2` (Zod schema upstream)
- `schema-dts` (devDep) — types disponíveis mas builders retornam `JsonLdNode`
  (`Record<string, unknown>`) por DX — os types narrow do `schema-dts` tornam
  asserts em tests/callers opacos sem ganho real de runtime safety

## Regras de negócio

1. **Server-only.** `index.ts` lê `env.NEXT_PUBLIC_APP_URL` (via `lib/env` —
   server-only). Não importar em Client Components.
2. **Sem `any`.** Todos os retornos são `JsonLdNode = Record<string, unknown>`.
3. **`address === null` → key omitida.** Nunca emitir `PostalAddress` vazio.
4. **Builders são puros.** Sem I/O, sem DB, sem cache. Recebem o subset de
   `SiteVariablesV2` já validado por Zod upstream (`readSiteVariablesSafe`).
5. **Ordem fixa no `@graph`.** `dealer → website → org → localbusiness`.
   Snapshot-locked em testes — drift quebra CI.
