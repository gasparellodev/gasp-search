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
- Futuramente: orquestração `generateLeadSite` (#159).

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
| `errors.ts` | `SlugCollisionError` (slug) + `GenerationError` / `GenerationErrorCode` (copy IA) — todos com contexto estruturado pra observabilidade. |
| `generate-copy.ts` | `generateCopy(input)` — 1 call Anthropic Sonnet 4.6 com tool use forçado `emit_site_copy` + system prompt cacheado. Valida output via `SiteCopySchema.parse`. Sem retry interno; orquestrador (#159) decide via `GenerationError.retryable`. Exporta `SYSTEM_PROMPT`, `GENERATION_VERSION='v1.0.0'`, `GENERATION_MODEL='claude-sonnet-4-6'`. |
| `sanitize.ts` | `sanitizeHex(input)` + `DEFAULT_HEX='#0C0C0C'`. Defesa em profundidade contra CSS injection: as cores `primary_color`/`text_on_primary` em `lead_sites.variables` são injetadas em `style="--site-primary: ..."` no `<SitePage>` wrapper. Mesmo com Zod no schema (#154), o banco pode ser editado fora do app e React `style` inline aceita qualquer string. Regex estrita `/^#[0-9a-f]{6}$/i`; tudo que não bate retorna `DEFAULT_HEX`. |
| `site-form.schema.ts` | `SiteFormSchema` Zod do form público de captura (`SiteForm` em #161). Compartilhado entre Client Component (`react-hook-form` + `zodResolver`) e Server Action `submitSiteForm` — fonte única de verdade. Aceita `phone` com formatação livre (10–13 dígitos numéricos pós-strip); `lgpd: z.literal(true)` (consentimento obrigatório). |
| `stock-photos.schema.ts` | `stockManifestSchema` Zod + enums `stockCarCategoryEnum` (`sedan|suv|picape|hatch|esportivo`) e `stockCarConditionEnum` (`0km|seminovo`). Tipos derivados `StockManifest`, `StockCarEntry`. URL é estritamente `/assets/stock/<file>.png` na V1. |
| `stock-photos.manifest.json` | Manifest V1 co-localizado: 14 carros (sea-doo NÃO incluído — jet ski não cabe em placeholder de concessionária). Importado via `import` JSON pra zero filesystem em runtime serverless. |
| `stock-photos.ts` | **Server-only.** `pickCarStock({ business_type: 'concessionaria', count, seed? })` — banco V1 de placeholders para `extractBrandAssets` (#156). Manifest validado no boot via top-level `parse`. Determinismo via Mulberry32 PRNG (zero deps) quando `seed` informado. Exporta `STOCK_PHOTOS_TOTAL = 14` e tipo `StockCarEntry`. |
| `brand-assets.types.ts` | `AssetSources` interface — saída do pipeline `extractBrandAssets`. Subset de `lead_sites.variables` que vem do brand pipeline (não da IA): `logo_url`, `primary_color`, `text_on_primary`, `hero_image_url`, `about_image_url`, `contact_hero_image_url`, `car_placeholder_urls` (length === 6). |
| `brand-assets.ts` | **Server-only.** `extractBrandAssets(lead): Promise<AssetSources>` — pipeline que **NUNCA lança**. Cascata logo: Instagram avatar → Maps profile photo → website favicon → monogram SVG (Vercel Blob, com data URI fallback). Cor primária via `node-vibrant` + `wcagContrast` (threshold 4.5 pra texto). Fotos: `fetchMapsPhotos` com fallback pra `stockShowroomPhotos`. Carros: `pickCarStock` (#157). Helpers exportados: `tryInstagramAvatar`, `tryGoogleMapsProfilePhoto`, `tryWebsiteFavicon`, `buildMonogramLogo`, `pickAccent`, `wcagContrast`, `contrastRatio`, `fetchMapsPhotos`, `stockShowroomPhotos`. |

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
- `zod-to-json-schema@^3.23` — converte `SiteCopySchema` em JSON Schema pro tool use.
- `apify-client@^2.23` — `extractBrandAssets` cascata (Instagram + Maps actors).
- `@vercel/blob@^0.27` — upload do SVG monogram em `lead-sites/monograms/<slug>.svg`.
- `node-vibrant@^3.1` — extração de palette do logo (CommonJS-stable; v4 tem ESM issues no Next.js).
- `@/lib/utils/slug` — base normalization.
- `@/types/lead-site` — `SiteCopySchema` + `SiteCopy` type (issue #154).
- `@/types/database` — schema dos lead_sites + leads.
