# `lib/sites/` — Domain helpers para Site Generator (Phase 7)

## Propósito

Lógica server-side do gerador de mini-sites para leads de concessionárias
(Phase 7 — Site Generator). Inclui:

- Geração de slug único (`slug.ts`).
- Erros tipados do domínio (`errors.ts`).
- Geração de copy via Anthropic (`generate-copy.ts`, #158).
- Banco V1 de stock photos para placeholder do site (`stock-photos.ts` +
  `stock-photos.manifest.json` + `stock-photos.schema.ts`, #157).
- Pipeline de brand assets (`brand-assets.ts` +
  `brand-assets.types.ts`, #156) — cascata logo, cor primária com WCAG,
  fotos com fallback, carros placeholder.
- Orquestração `generateLeadSite(leadId)` (`app/actions/lead-site.ts`, #159)
  — combina os helpers acima com auth, rate-limit DB-backed
  (`generation_throttle`, migration 0011), URL sanitization e validação
  Zod final antes do persist em `lead_sites`.

## Como adicionar

- 1 responsabilidade por arquivo. Funções compostas vão pra um
  orquestrador dedicado (`generate.ts` na issue #159).
- Erros customizados vão sempre em `errors.ts` (não inline) — facilita
  catch tipado no caller.
- **DI vs singleton (escolher por client):**
  - **Supabase:** DI explícita — receber `client: SupabaseClient<Database>`
    como parâmetro. Razões: suporte a `service-role` vs sessão de usuário
    no mesmo helper; testes sem `vi.mock` global.
  - **Anthropic:** singleton compartilhado — `import { anthropic } from
    '@/lib/ai/anthropic'`. Razão: o SDK não tem variantes de auth, a chave
    é única, e o caching de cliente economiza handshake. Testes mockam
    `@anthropic-ai/sdk` via `vi.mock` (ver `generate-copy.test.ts`).
- TDD obrigatório: teste em `tests/unit/lib/sites/<nome>.test.ts` antes
  da implementação.
- **Mock Anthropic em CI (BLOQUEANTE).** Nenhum teste em `tests/unit/`
  pode chamar a API real. Padrão: `vi.mock('@anthropic-ai/sdk', () => ({
  Anthropic: class { messages = { create: vi.fn() }; constructor() {} } }))`.
  Ver `tests/unit/lib/sites/generate-copy.test.ts` como referência.

## Regras de negócio

1. **Slug global único.** `lead_sites.slug` é único em toda a tabela
   (não escopado por `user_id`) porque rotas públicas (`/s/<slug>`) não
   conhecem o usuário. O DB enforça via unique index `lead_sites_slug_uniq`
   (criado na migration de #153).
2. **TOCTOU é responsabilidade do caller.** Funções aqui propõem
   resultados consultando o DB; a garantia final é o constraint do DB.
   `generateUniqueSlug` propõe, mas `INSERT` em `lead_sites` pode falhar
   com `23505` (`unique_violation`) em race condition — caller decide
   retry vs propagar.
3. **Server-only por padrão.** Helpers que tocam Supabase/Anthropic
   importam `server-only` (a pasta como um todo é tratada como server).
   Hoje `slug.ts`/`errors.ts` não precisam (são puros + recebem client
   por DI), mas o padrão vale pra novos arquivos.
4. **Sem `any`.** Use tipos do `Database` (`@/types/database`).

## Arquivos

| Path | Propósito |
|---|---|
| `slug.ts` | `generateUniqueSlug(business_name, client)` — `<nanoid8>-<base>` com retry × 5 contra `lead_sites.slug`. Lança `SlugCollisionError` em exhaustão. Alfabeto sem `0/o/1/i/l`. |
| `errors.ts` | `SlugCollisionError` (slug) + `GenerationError` / `GenerationErrorCode` (copy IA) + `LeadNotFoundError` / `RateLimitError` / `SiteVariablesValidationError` (orquestrador #159) — todos com contexto estruturado pra observabilidade. |
| `generate-copy.ts` | `generateCopy(input)` — 1 call Anthropic Sonnet 4.6 com tool use forçado `emit_site_copy` + system prompt cacheado. Valida output via `SiteCopySchema.parse`. Sem retry interno; orquestrador (#159) decide via `GenerationError.retryable`. Exporta `SYSTEM_PROMPT`, `GENERATION_VERSION='v1.0.0'`, `GENERATION_MODEL='claude-sonnet-4-6'`. |
| `sanitize.ts` | `sanitizeHex(input)` + `DEFAULT_HEX='#0C0C0C'` + `safeUrl(input)`. **`sanitizeHex`**: defesa em profundidade contra CSS injection — regex estrita `/^#[0-9a-f]{6}$/i`. **`safeUrl`**: defesa em profundidade contra script injection em URLs vindas do pipeline de brand assets — só aceita `http:`/`https:`, retorna `null` para `javascript:`/`data:`/`file:`/`vbscript:`/qualquer outro scheme. Aplicado em todas URLs de imagem antes do `SiteVariables.parse` no orquestrador `generateLeadSite` (#159). |
| `site-form.schema.ts` | `SiteFormSchema` Zod do form público de captura (`SiteForm` em #161). Compartilhado entre Client Component (`react-hook-form` + `zodResolver`) e Server Action `submitSiteForm` — fonte única de verdade. Aceita `phone` com formatação livre (10–13 dígitos numéricos pós-strip); `lgpd: z.literal(true)` (consentimento obrigatório). |
| `site-assets.ts` | **Pure (sem `server-only`).** Centraliza paths de assets visuais do Site Generator. `SITE_ASSETS` const inclui `hero.texture` (textura grain decorativa fixa — sempre `/assets/hero/texturatc.png`), `hero.demoCarCutout` (Pulse PNG transparente, default global quando `lead_sites.payload.variables.hero_image_url` é null/vazio), e demos pra emphasis/recentSales. Helper `resolveHeroImageUrl(hero_image_url)` retorna o URL do lead ou cai no `demoCarCutout`. **Pra trocar imagem demo globalmente: edita só este arquivo. Pra trocar por lead: atualiza payload no Supabase.** Decisão arquitetural 2026-05-09: usuário gerencia imagens manualmente, sem brand-pipeline raspagem no V1. |
| `announcement.schema.ts` | `AnnouncementSchema` Zod do `AnnounceForm` (`/anunciar` em #163). Compartilhado entre Client Component e Server Action `submitAnnouncement` — fonte única de verdade. Campos: `marca`, `modelo`, `ano` (1980..currentYear+1), `km` (≥0), `preco` (≥0, opcional/null), `nome`, `telefone` (10–13 dígitos pós-strip), `email`, `mensagem` (opcional, max 1000), `lgpd_consent: literal(true)`. |
| `get-site.ts` | **Server-only.** `getSite(slug)` cacheado com `'use cache'` + `cacheTag(\`site:\${slug}\`)` + `cacheLife({revalidate:3600,expire:86400})`. Lê `lead_sites` por slug global único via `service-role` (rota pública sem `auth.uid()`). Retorna `SiteRow \| null` — caller decide `notFound()`. Extraído de `app/sites/[slug]/page.tsx` em #163 para reuso por `/sobre`, `/contato`, `/anunciar` (e #164/#165 quando chegarem). **#199:** `SiteRow` agora inclui `signed_at: string \| null` (select adiciona a coluna) — necessário pro gate `isIndexable(site)` em `metadata.ts`. **#217 (Sprint 2 / #A3):** `SiteRow.visual_identity: VisualIdentityManifest \| null` (select adiciona `visual_identity` JSONB de `lead_sites`, migration 0019). Defesa em profundidade: `VisualIdentityManifestSchema.safeParse` no boundary — manifest inválido vira `null` + `console.warn('getSite:visual_identity:parse_fail', { slug, issuePaths })` (sem PII). Consumido pelas 3 sub-rotas públicas (`/sites/[slug]`, `/sobre`, `/contato`) e `opengraph-image.tsx` via fallback `manifest?.X_url ?? variables.brand_assets.X_image_url`. Tag de cache compartilhada com o `getSite` original — `updateTag('site:<slug>')` em `regenerateVisualIdentity` (#216) invalida ambos os reads transitivamente. Comportamento backward-compat — testes em `tests/unit/lib/sites/get-site.test.ts`. |
| `metadata.ts` | **Server-only.** `buildSiteMetadata({ variables, pageLabel, site?, pathname?, route? })` — helper compartilhado pelo `generateMetadata` das 6 rotas `/sites/[slug]/*` (#165, #199, #206). **v3 (#199 — SEO foundation):** exporta `isIndexable(site)` (whitelist `status IN ('published','sent') AND signed_at !== null`); `metadataBase` sempre presente (= `env.NEXT_PUBLIC_APP_URL`); `alternates.canonical` absoluto via `business_slug` + `pathname`; `alternates.languages` `pt-BR` + `x-default` apontam pro canonical; `robots.index/follow` togglado via `isIndexable(site)` quando `site` provided; quando `route` discriminator é passado, ativa city-aware title/description patterns (Home/Estoque/Detalhe/Sobre/Contato/Anunciar) com fallback gracioso pra `address === null`; description truncado em `DESCRIPTION_MAX_LENGTH=160`. **Backward-compat:** `site`/`pathname`/`route` opcionais — sem `site` cai pra noindex (compat com callers v1); sem `route` usa legacy `${business_name} — ${pageLabel}`. Caller é responsável por **não** chamar este helper em fallback paths (`null`/`draft`/`archived`/safeParse falho); nesses casos retorna apenas `{ robots: noindex }` para não vazar metadata parcial. Exporta `DESCRIPTION_MIN_LENGTH=40` (boundary inclusive), `DESCRIPTION_MAX_LENGTH=160`, `isIndexable`, tipos `SiteMetadataInput`, `IndexableSite`, `SiteRoute`. Função "pura" no sentido funcional (sem DB), mas lê `env.NEXT_PUBLIC_APP_URL` — testes herdam o default `http://localhost:3000` do `vitest.setup.ts`. |
| `stock-photos.schema.ts` | `stockManifestSchema` Zod + enums `stockCarCategoryEnum` (`sedan|suv|picape|hatch|esportivo`) e `stockCarConditionEnum` (`0km|seminovo`). Tipos derivados `StockManifest`, `StockCarEntry`. URL é estritamente `/assets/stock/<file>.png` na V1. |
| `stock-photos.manifest.json` | Manifest V1 co-localizado: 14 carros (sea-doo NÃO incluído — jet ski não cabe em placeholder de concessionária). Importado via `import` JSON pra zero filesystem em runtime serverless. |
| `stock-photos.ts` | **Server-only.** `pickCarStock({ business_type: 'concessionaria', count, seed? })` — banco V1 de placeholders para `extractBrandAssets` (#156). Manifest validado no boot via top-level `parse`. Determinismo via Mulberry32 PRNG (zero deps) quando `seed` informado. Exporta `STOCK_PHOTOS_TOTAL = 14` e tipo `StockCarEntry`. |
| `brand-assets.types.ts` | `AssetSources` interface — saída do pipeline `extractBrandAssets`. Subset de `lead_sites.variables` que vem do brand pipeline (não da IA): `logo_url`, `primary_color`, `text_on_primary`, `hero_image_url`, `about_image_url`, `contact_hero_image_url`, `car_placeholder_urls` (length === 6). |
| `brand-assets.ts` | **Server-only.** `extractBrandAssets(lead): Promise<AssetSources>` — pipeline que **NUNCA lança**. Cascata logo: Instagram avatar → Maps profile photo → website favicon → monogram SVG (Vercel Blob, com data URI fallback). Cor primária via `node-vibrant` + `wcagContrast` (threshold 4.5 pra texto). Fotos: `fetchMapsPhotos` com fallback pra `stockShowroomPhotos`. Carros: `pickCarStock` (#157). Helpers exportados: `tryInstagramAvatar`, `tryGoogleMapsProfilePhoto`, `tryWebsiteFavicon`, `buildMonogramLogo`, `pickAccent`, `wcagContrast`, `contrastRatio`, `fetchMapsPhotos`, `stockShowroomPhotos`. |
| `dispatch-site-preview.ts` | **Server-only.** `dispatchSitePreview({ supabase, service, userId, leadId, sendImpl? })` — núcleo extraído de `sendLeadSiteWhatsApp` (#171) pra ser reusado pelo processor de campanhas `type='site_preview'` (#172). Pipeline: fetch `lead_sites` por `lead_id` → status guard (`'published'`/`'sent'`) → **`checkDailyInstanceLimit` (#173, anti-ban WhatsApp 50/dia/instância)** → fetch `lead.name` → render `SITE_PREVIEW_TEMPLATE` → `sendWhatsAppMessage` → update `lead_sites.status='sent'` via service-role. Retorno discriminated union (`'no_site' \| 'invalid_status' \| 'rate_limit_daily' \| 'render_error' \| 'whatsapp_error' \| 'db_error'`). **Não faz auth nem cache invalidation** — caller é responsável (Server Action `sendLeadSiteWhatsApp` em `app/actions/lead-site.ts` continua dono dessas duas responsabilidades). |
| `merge.ts` | **Server-only.** `clampBusinessName(input)` + `buildAddressFromLead(lead)` + `mergeSiteVariables(lead, assets, copy)` + `BUSINESS_NAME_MAX=80` + `FALLBACK_IMAGE_URL`. Extraído de `app/actions/lead-site.ts` em 2026-05-09 pra permitir testes diretos do merge — em arquivo `'use server'` só async functions podem ser exportadas, então pure helpers ficam aqui. `clampBusinessName` resolve falhas de `SiteVariablesV2.parse` quando `lead.name` (do Apify Maps) excede 80 chars: corta no primeiro separador natural (`\| - ( : , .`) ou hard-truncate com ellipsis. **`mergeSiteVariables` emite shape v2 (#197 PR-C):** retorna objeto com `address` (via `buildAddressFromLead` — `null` quando lead V1 não tem street/number/neighborhood/zip estruturados, evitando crash em `Address.parse`), `brand_assets` nested (renomeio `contact_hero_image_url` → `contact_image_url`, `car_placeholders` populado dos 6 primeiros do pipeline), `cars[]` v2 (cada item com `category: 'Sedan'` default, `photos[]` length 3 derivado de `car_placeholders` cíclico, `plates_visible: false` literal compliance), e `schema_version: 2`. Retorna `unknown` propositalmente — schema é validado em `lead-site.ts` via `SiteVariablesV2.parse(merged)`. |
| `list-indexable-sites.ts` | **Server-only.** `listIndexableSites()` — lista sites para `/sitemap.xml` (issue #212 / Sprint 1 / #S2). Helper novo (NÃO reusa `getSite`) porque o sitemap controla cache via `export const revalidate = 3600` na rota — misturar com `'use cache'` directive criaria caching dual confuso. Query via `createServiceSupabase()` (rota pública sem `auth.uid()`): `.from('lead_sites').select('slug, variables, updated_at, signed_at, status').in('status', ['published','sent']).not('signed_at', 'is', null)`. **Defense in depth**: aplica `.filter(isIndexable)` após o fetch — redundância intencional pra defender contra drift entre SQL filter e gate canônico em `metadata.ts` (e.g. se um novo status `pending` for adicionado). Em DB error retorna `[]` + `console.error` (graceful degradation — sitemap vazio é válido per protocol, não derruba o crawl com 500). |
| `llms.ts` | **Server-only.** Pure helper `renderLlmsTxt({ variables: SiteVariablesV2, slug: string }): string` que monta o Markdown plain do `llms.txt` consumido por AI crawlers (issue #214 / Sprint 1 / #S4 — fecha ciclo GEO). Sem I/O — recebe `variables` já validado upstream + lê apenas `env.NEXT_PUBLIC_APP_URL` pra links absolutos. **Decisões PO (#214):** (1) Frase factual sem "loja online" — evita expectativa de e-commerce; usa "loja de carros seminovos" consistentemente. (2) Hedging "Consulte estoque atualizado" só no rodapé. (3) Address null → frase Sobre usa "no Brasil" (não omite). (4) Linhas null (phone/email/address) → OMITIDAS, sem "undefined". (5) `business_name` empty → fallback "Loja de carros seminovos". (6) Estoque snapshot capped em 6 cars (alinha com schema). (7) Sem BOM UTF-8. (8) Sem PII de leads — só dados públicos do negócio (business_name, telefone comercial, endereço da loja). Output determinístico dado mesmo input — testado via snapshot + edge cases em `tests/unit/lib/sites/llms.test.ts`. Consumido só por `app/sites/[slug]/llms.txt/route.ts`. |
| `visual-identity.ts` | **Server-only.** Phase 7 Sprint 2 #A2 (issue #216 — `regenerateVisualIdentity` action). Pipeline de geração de identidade visual AI (9 banners por site V1: 1 hero + até 6 categories + 1 about + 1 contact, matching `VisualIdentityManifestSchema` em `types/visual-identity.ts`). Exporta: (a) `ALL_ASSET_SPECS` (9 specs estáticas: hero/about/contact = 1536x1024 medium, categories = 1024x1024 medium); (b) `CAR_CATEGORIES` constante (`SUV`/`Sedan`/`Hatch`/`Pickup`/`Esportivo`/`Conversível` — espelha `SiteCar.category`); (c) `buildAssetSpecsForCars(cars)` (filtra categorias presentes nos cars; fallback Sedan se nenhuma); (d) `buildPrompt(spec, ctx)` puro com interpolação `{{business_name}}` + `{{city_state}}` + `{{primary_color}}`; (e) `ANTI_HALLUCINATION_CLAUSE` const presente em TODOS templates (snapshot-locked test bloqueia drift que cause text/logos/license plates/brand badges vazarem); (f) `buildIdentityContext(siteVars)` extrai de SiteVariables v1 ou v2 (fallback primary_color `#0c0c0c`); (g) `estimateTotalCost(specs, modelOverride?)` retorna `{usd, brl}` usando `PRICING_USD` × `env.BRL_RATE` (default 5.0 hardcoded V1, sem realtime FX); (h) `uploadAssetToStorage({b64, slug, key, supabase})` → bucket `visual-identity` (público criado em migration 0019) via service-role com path `<slug>/<key>-<timestamp>.png`; (i) `deleteExistingAssets(slug, supabase)` lista+remove `visual-identity/<slug>/*` pra rerun limpo (`force=true`). Custo target: ~$0.49 USD/cliente (Tier-1 OpenAI). **Decisões PO V1**: schema só 9 assets matching #215 (warranty/tradein/og separado fica pra A2.b); concurrency 2 default via `env.OPENAI_IMAGE_CONCURRENCY` (Tier-1-safe); fallback model `gpt-image-1-mini` (NÃO dall-e-3 — deprecada 2026-05-12); cost guardrail $2 USD hard cap no caller. |
| `stock-search-params.ts` | **Pure (sem `server-only`).** Phase 7 Sprint 4 / #H1 (issue #221). Fonte única de verdade pro querystring do quick search da Home + filtro do `/estoque` (#224 / E1). Exporta `serializeQuickSearch({brand, model, priceMax})` (emite `m=...&model=...&p=...` com short keys per PO refinement) e `parseQuickSearch(input)` (aceita `URLSearchParams` ou `Record<string, string \| string[] \| undefined>` compatível com Next searchParams). Campos vazios/null/invalid são OMITIDOS no serialize. `priceMax` ≤ 0 / NaN → ignorado; decimais arredondados via `Math.floor`. Round-trip serialize/parse preserva campos válidos. Pure module — pode ser importado tanto em Client (HomeQuickSearchBar) quanto Server Components (`/estoque` page #224). |
| `warranty-bullets.ts` | **Pure (sem `server-only`).** Phase 7 / Sprint 4 / #H3 — issue #223. Exporta `WARRANTY_BULLETS: readonly string[]` com 4 bullets PT-BR canônicos consumidos por `<HomeWarrantySection>`. Mudanças requerem PO sign-off (mudança de copy do produto). Sem reuso fora de `<HomeWarrantySection>` — outras surfaces (`/sobre`, `/contato`) têm próprio copywriting. |
| `process-steps-template.ts` | **Pure (sem `server-only`).** Phase 7 / Sprint 4 / #H3 — issue #223. Exporta `PROCESS_STEPS_TEMPLATE: readonly ProcessStep[]` (3 steps) e `interface ProcessStep { icon: LucideIcon; title: string; body: string }`. Conteúdo PT-BR canônico consumido por `<HomeProcess3Steps>`: Search/"Escolha seu carro", FileText/"Aprovação simples", KeyRound/"Leve pra casa". Mudanças requerem PO sign-off. |
| `faq-template.ts` | **Pure (sem `server-only`).** Phase 7 / Sprint 4 / #H3 — issue #223. Exporta `FAQ_TEMPLATE: readonly FaqEntry[]` (8 perguntas — range PO 7-10) e `interface FaqEntry { question: string; answer: string }`. Conteúdo PT-BR canônico consumido por `<HomeFAQSection>` (Radix Accordion). **Não emite JSON-LD `FAQPage`** (anti-pattern DESIGN.md — Google penaliza FAQPage em business sites desde 2023). Mudanças requerem PO sign-off. |
| `schema.ts` | **Server-only.** Builders puros JSON-LD Schema.org pro Site Generator (issue #211 / Sprint 1 / #S1; WebSite adicionado em #213 / #S3). Exporta `buildAutoDealerSchema`, `buildOrganizationSchema`, `buildLocalBusinessSchema`, `buildVehicleSchema(car, variables)`, `buildBreadcrumbSchema(items)`, `buildWebSiteSchema(variables)`, `buildSitewideGraph(variables)` (consolidado `@graph` pro layout) e `type JsonLdNode = Record<string, unknown>`. Recebe subset de `SiteVariablesV2` validado por Zod upstream (`readSiteVariablesSafe`). Lê apenas `env.NEXT_PUBLIC_APP_URL` para montar `@id` absolutos com fragments (`#dealer`, `#website`, `#org`, `#localbusiness`, `#vehicle`). **Decisões PO (#211 / #213):** (1) `@graph` single-script no layout com 4 nodes (AutoDealer + WebSite + Organization + LocalBusiness) — ordem fixa `dealer → website → org → localbusiness` pra snapshot/test estável; linking via `@id` valida melhor no Rich Results Test. (2) `address === null` → key omitida (não emite `PostalAddress` vazio). (3) Schemas SEMPRE injetados pelo caller mesmo quando `isIndexable=false` — AI crawlers (ChatGPT/Perplexity/Claude/Gemini) consomem JSON-LD ignorando `robots:noindex`. (4) `Vehicle.itemCondition: 'https://schema.org/UsedCondition'` fixed (produto é seminovos por design). (5) `Vehicle.priceCurrency: 'BRL'` fixed. (6) `Vehicle.image: car.photos[]` array completo quando length > 0, fallback `thumbnail_url` (legado v1). (7) `Organization.sameAs` omitido quando todas social URLs null. (8) `AutoDealer.priceRange` calculado de `min/max(cars[].price)` — omitido quando `cars.length === 0`. (9) **#213 — `WebSite`** com `publisher: { @id: #org }` (cross-reference, não duplica dados); `inLanguage: 'pt-BR'` fixed; V1 SEM `potentialAction.SearchAction` (adicionar em V2 quando estoque ganhar query filterable). **`schema-dts@^1` (devDep)** está instalado mas builders retornam `JsonLdNode` (não `WithContext<X>`) porque os types narrow do schema-dts inviabilizam asserts em tests/callers — DX > tipagem opaca. Validação runtime fica no Rich Results Test (manual) + 44 tests em `tests/unit/lib/sites/schema.test.ts`. |

## Contrato de erro do `generateCopy`

| `code` | `retryable` | Quando |
|---|---|---|
| `no_tool_use` | `true` | Resposta sem block `tool_use` — modelo pode acertar na próxima |
| `api_error` | `true` | SDK lançou (rate-limit / 5xx / network) |
| `schema_validation` | `false` | `tool_use.input` não passa em `SiteCopySchema` (cause = `ZodError`) |
| `max_tokens` | `false` | `stop_reason='max_tokens'` (precisa input menor, não retry) |
| `unknown` | `false` | Fallback defensivo |

`GENERATION_VERSION` é persistido em `lead_sites.variables.generation_version`. Bump SEMVER quando `SiteCopySchema` ou `SYSTEM_PROMPT` mudarem materialmente — permite migração offline de sites antigos.

## Contrato de `pickCarStock`

Chamado por `extractBrandAssets` (M1.4 / #156) para popular
`lead_sites.variables.car_placeholder_urls` no preview do site.

| Cenário | Comportamento |
|---|---|
| `count: 0` | Retorna `[]` (não erro) |
| `count: 6` | Retorna 6 entries únicos |
| `count: 14` | Retorna todos os 14 sem repetição |
| `count: 15` | Lança `Error('count exceeds total available stock (15 requested, 14 available)')` |
| `seed: 'lead-abc'` (mesma) | Ordem reprodutível em qualquer máquina/processo |
| `seed: 'a'` vs `seed: 'b'` | Ordens diferentes (mesmo conjunto) |
| Sem `seed` | Não-determinístico (`Math.random()`) — aceitável pra preview ad-hoc |

Determinismo é crítico porque `car_placeholder_urls` é persistido no DB:
sem seed estável, cada regen mexeria na ordem e quebraria a expectativa
de "mesmo lead → mesmo preview".

## Contrato de `extractBrandAssets` (#156)

Chamado pelo orquestrador `generateLeadSite` (#159) — produz o subset
de `lead_sites.variables` que vem de fontes externas (Instagram, Maps,
website, Vercel Blob, node-vibrant) com **garantia BLOQUEANTE** de não
lançar.

### Cascata logo

| Step | Fonte | Quando retorna `null` |
|---|---|---|
| 1 | Instagram avatar (Apify `apify~instagram-scraper`) | handle null, actor falha, sem `profilePicUrl` |
| 2 | Google Maps profile photo (Apify `compass~crawler-google-places`) | placeId null, actor falha, sem `imageUrls` |
| 3 | Website favicon (HTML scrape, AbortController 5s) | URL null, fetch !ok, sem `<link rel=icon>`, timeout |
| 4 | Monogram SVG (Vercel Blob `put`) | nunca retorna null — Blob ok ou data URI inline fallback |

### Cor primária

`Vibrant.from(logo_url).getPalette()` → `pickAccent(palette)` →
`wcagContrast(primary)` decide texto sobre fundo (`#FFFFFF` se contrast
ratio com white ≥ ratio com `#0C0C0C`, senão `#0C0C0C`).

Logos `data:` ou `.svg` pulam o Vibrant (usa `#000000`) — Vibrant em
Node não suporta esses formatos.

### Fotos

`fetchMapsPhotos(placeId, 3)` retorna até 3 fotos do Maps. Resultado é
completado com `stockShowroomPhotos` (3 entries em `public/assets/`)
até totalizar 3 (`hero` / `about` / `contact`). Em fallback total,
todas vêm do stock.

### Catastrofic fallback

`extractBrandAssets` envolve tudo em try/catch top-level. Se algo
escapar dos try/catch internos, retorna:

- `logo_url`: data URI base64 do SVG monogram (sem hit no Blob).
- `primary_color`: `#000000`.
- `text_on_primary`: `#FFFFFF`.
- 3 fotos do `stockShowroomPhotos`.
- 6 carros via `pickCarStock` (com fallback final pra strings vazias se
  o manifest também falhar).

## Dependências

- `nanoid@^5` — `customAlphabet` para prefix legível.
- `@supabase/supabase-js` — tipo `SupabaseClient<Database>` (DI).
- `@anthropic-ai/sdk` — via `@/lib/ai/anthropic` (singleton).
- `zod@^4` — `z.toJSONSchema(SiteCopySchema)` converte para JSON Schema (draft-2020-12) usado em `tools[].input_schema`. Anteriormente usava `zod-to-json-schema@3`, mas esse pacote é incompatível com Zod v4 (emite output sem `type`/`properties`, quebrando a chamada com `tools.0.custom.input_schema.type: Field required`).
- `apify-client@^2.23` — `extractBrandAssets` cascata (Instagram + Maps actors).
- `@vercel/blob@^0.27` — upload do SVG monogram em `lead-sites/monograms/<slug>.svg`.
- `node-vibrant@^3.1` — extração de palette do logo (CommonJS-stable; v4 tem ESM issues no Next.js).
- `@/lib/utils/slug` — base normalization.
- `@/types/lead-site` — `SiteCopySchema` + `SiteCopy` type (issue #154).
- `@/types/database` — schema dos lead_sites + leads.
