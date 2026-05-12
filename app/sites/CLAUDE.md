# `app/sites/` — Rotas públicas dos sites de leads (Phase 7)

## Propósito

Rotas dinâmicas (Next App Router) que renderizam os sites públicos
gerados pelo Site Generator. URL canônica:
`gasp-search.com/sites/<slug>`.

Diferente de `app/(app)/...` (área autenticada do GaspLab):

- **Sem auth.** O acesso é por slug global único (privacy-by-obscurity).
- **Service-role** confinado: a leitura usa `createServiceSupabase`
  (server-only) porque não há `auth.uid()` para a RLS resolver.
- **`noindex`** obrigatório — site de lead não vai pra SERP.

Fonte canônica do design: §8 do spec mestre em
`docs/superpowers/specs/2026-05-08-gerador-sites-concessionarias-design.md`.

## Como adicionar

- **Página de site** (`/sites/[slug]/sobre`, `/sites/[slug]/contato`,
  etc.): arquivo `app/sites/[slug]/<rota>/page.tsx`. Reutiliza
  `getSite(slug)` do `page.tsx` raiz (idealmente extraído pra
  `lib/sites/get-site.ts` quando >1 caller existir — issues #162-#164).
- **Components** que renderizam o conteúdo (Hero, Categories, etc.)
  vivem em `components/sites/`.
- **Server Components por padrão.** O Site Generator é static-friendly
  (sem cookies, sem auth) — qualquer 'use client' deve ter justificativa.

## Regras de negócio

1. **`'use cache'` directive** em todas as queries Supabase desta área
   (Server Components, `page.tsx`, helpers de `lib/sites/`). Sem isso,
   cada request bate o banco — caro e lento. Sempre acompanhar de
   `cacheTag(\`site:\${slug}\`)` para invalidação targeted. **Exceção:
   Route Handlers (`route.ts`) e Next Metadata files (`opengraph-image.tsx`,
   `llms.txt/route.ts`) que retornam `Response` NÃO podem usar
   `"use cache"`** — o `Response` é built-in com prototype não-plain e
   crasha o cache boundary do Next 16 (PR #246). E `cacheTag` precisa
   estar DENTRO de `"use cache"` (Next 16 valida em runtime). Padrão
   alternativo: `export const revalidate = 3600` no topo do arquivo
   e DEPENDER da invalidação transitiva via `getSite()` que carrega
   o `cacheTag('site:<slug>')` internamente.
2. **`cacheLife({ revalidate: 3600, expire: 86400 })`** é o profile
   padrão pra sites em Server Components com `"use cache"`:
   stale-while-revalidate por 1h, expire em 24h. Em Route Handlers
   (sem `"use cache"`), usar `export const revalidate = 3600` que
   replica o `revalidate` do profile. Sites editados pela ficha do
   lead invalidam manualmente via `updateTag('site:<slug>')` em
   `app/actions/lead-site.ts`.
3. **Service-role só aqui (e em `app/actions/lead-site.ts` + handler do
   webhook do WhatsApp).** Allowlist enforced via grep:
   `rg -l 'createServiceSupabase|SUPABASE_SERVICE_ROLE_KEY' --type ts --type tsx | sort`
   deve retornar exatamente:
   - `lib/supabase/service.ts` (definição)
   - `lib/sites/get-site.ts` (helper compartilhado pelas rotas públicas — extraído em #163)
   - `app/actions/lead-site.ts` (caller server-action)
   - `app/api/whatsapp/webhook/route.ts` (handler webhook HMAC-verificado)
   - `lib/env.ts` (validador da env)
   - arquivos de teste (`tests/...`)
   As rotas em `app/sites/[slug]/...` consomem `getSite` por dependência;
   nenhuma toca `createServiceSupabase` direto.
4. **`SiteVariables.safeParse` antes do render.** Defesa em
   profundidade — se a IA gravou JSON quebrado em
   `lead_sites.variables`, a página cai em `notFound()` em vez de
   crashar o React rendering. Logamos `slug` + paths Zod (sem PII).
5. **Routing por status** (per spec §4):
   | Status | Visitante vê |
   |---|---|
   | `null` (slug missing) | 404 |
   | `draft` | 404 |
   | `archived` | 404 (V1 — TODO 410 V2) |
   | `published` | site renderizado |
   | `sent` | site renderizado |
6. **`generateMetadata` dinâmico (#165) com `noindex/nofollow`
   PRESERVADO em todos os caminhos.** Cada rota exporta
   `async generateMetadata({ params })` que:
   - Em **happy path** (status `published`/`sent` + `safeParse` ok)
     delega pra `buildSiteMetadata({ variables, pageLabel })` em
     `lib/sites/metadata.ts` — emite title `${business_name} —
     ${pageLabel}`, description (slogan ≥40 chars ou fallback), OG
     image (`logo_url`) e Twitter `summary_large_image`. `robots:
     { index: false, follow: false }` segue presente.
   - Em **fallback path** (`getSite` null, `draft`, `archived`,
     `safeParse` falho, ou `cars.find` undefined no detalhe-do-carro)
     retorna **apenas** `{ robots: { index: false, follow: false } }`
     — sem expor title/OG/Twitter (evita vazar nome/logo de site não
     publicado ou inválido).

   Por que não usar `metadata` estático? V1 tinha `export const
   metadata = { robots: noindex }`. Funcionava, mas perdia OG/Twitter
   pra preview rico em compartilhamento via WhatsApp (caso de uso
   primário do MVP). `generateMetadata` resolve isso sem perder
   `noindex`.

   `pageLabel` por rota: `Concessionária` (Home), `Sobre nós`,
   `Contato`, `Anunciar`, `Estoque`, `${car.brand} ${car.model}
   ${car.year}` (detalhe). Hardening adicional via `X-Robots-Tag`
   header em V2.
7. **Sem PII em logs.** Nunca logar `variables` cru, `business_name`,
   `email`, telefone, ou copy gerada — o site contém todos esses dados.

## Arquivos

| Path | Propósito |
|---|---|
| `[slug]/page.tsx` | Rota raiz `/sites/<slug>`. `getSite(slug)` (de `lib/sites/get-site.ts`) cacheado + status routing + Zod validation + `<SitePage>` (renderiza Home composition). |
| `[slug]/sobre/page.tsx` | Rota `/sites/<slug>/sobre` (#163, redesign #229). Reutiliza `getSite` + `<SitePage activePage="sobre">`, preserva BreadcrumbList e compõe `AboutHeroEditorial`, `AboutMissionVision`, `AboutWarrantyDeepdive` (`#garantia`), `HomeGoogleReviewsEmbed` e `HomeContactFormQuick` via children. |
| `[slug]/contato/page.tsx` | Rota `/sites/<slug>/contato` (#163, redesign #230). Reutiliza `getSite` + `<SitePage activePage="contato">`, preserva BreadcrumbList e monta `staticMapUrl` opcional via `GOOGLE_MAPS_STATIC_API_KEY` + best-effort `leads.raw` (`placeId`/`location.lat`/`location.lng`) antes de injetar `<ContactSection>`. Sem chave ou coordenadas, a UI cai em placeholder + link Google Maps por endereço. |
| `[slug]/anunciar/page.tsx` | Rota `/sites/<slug>/anunciar` (#163/#231). Reutiliza `getSite` + `<SitePage activePage="anunciar">` com `<AdvertiseSection>` (server) + `<AnnounceForm>` (client) injetados via children. Aceita `?car_target_slug=`; resolve contra `cars[]`, ignora silenciosamente quando inválido e passa `targetCar`/`targetCarSlug` para o hero/form quando válido. Cria assinatura de contexto via `createAnnouncementFormSignature(siteId,targetSlug)` para HMAC opcional do submit. |
| `[slug]/estoque/page.tsx` | Rota `/sites/<slug>/estoque` (#164, refactor #224/#225). Reutiliza `getSite` + `<SitePage activePage="estoque">` com `<StockSection>` injetado. Recebe `searchParams` completo e chama `parseStockFilters` para short keys canônicas (`m`, `model`, `c`, `pmin`...) + passthrough (`sort`, `page`) antes de passar `initialFilters` ao client orchestrator. `loading.tsx` da rota usa skeleton de 6 cards com raio 8px para casar com `<CarCard>`. |
| `[slug]/layout.tsx` | Layout Auto Showroom de `/sites/<slug>/*`. Aplica `data-theme="auto-showroom"`, injeta JSON-LD sitewide quando `getSite()` + `readSiteVariablesSafe()` passam e, desde #220, renderiza `<WhatsAppFloatingCTA>` global para sites válidos/published/sent usando template `general`. **#234:** também injeta `<CookieBanner>` global para sites válidos; necessário/analytics/marketing são opt-in via `localStorage` + auditoria em `consent_logs`. |
| `[slug]/lgpd/page.tsx` | Rota `/sites/<slug>/lgpd` (#234). Reutiliza `getSite` + `<SitePage activePage="lgpd">` e renderiza política PT-BR com placeholders de `business_name`/`contact_email`. Status `draft`/`archived` e variables inválido → 404. Metadata sempre `noindex`. |
| `[slug]/estoque/[carSlug]/page.tsx` | Rota `/sites/<slug>/estoque/<carSlug>` (#164). Reutiliza `getSite`, faz `cars.find(c => c.slug === carSlug)` (404 se não achar), renderiza `<CarDetailSection>` dentro de `<SitePage activePage="estoque">`. **#226 D1:** o section compõe breadcrumb visual shared, galeria cinema scroll-snap + lightbox Radix, info block e spec grid; o BreadcrumbList JSON-LD continua aqui via `<SiteSchema>`. **#232:** se não houver match exato, tenta slug legado `{brand}-{model}-{year}` e emite `permanentRedirect()` para o `car.slug` salvo no payload novo (`{brand}-{model}-{year}-{id4}`); payloads antigos continuam funcionando por match exato. **#220:** adiciona `mainClassName="pb-24 lg:pb-0"` e `<FloatingInstallmentBar>` com contexto serializado do carro para evitar overlap mobile e fetch client-side duplicado. |
| `[slug]/opengraph-image.tsx` | **OG image dinâmica (#213 / Sprint 1 / #S3, fix #247/#244/#245).** Next Metadata file convention `opengraph-image.tsx`. Gera PNG 1200×630 via `next/og` `ImageResponse` consumido por scrapers de social (Facebook/Twitter/WhatsApp). `runtime='edge'` (trade-off explícito PO: workload curto, sem deps Node-only, cold-start Edge < Node pra ImageResponse). **Cache (#247)**: `export const revalidate = 3600` (ISR 1h) + invalidação transitiva via `getSite()` (que carrega `"use cache"` + `cacheTag('site:<slug>')` internamente). NÃO usar `cacheTag` standalone no handler (Next 16: `Error: 'cacheTag()' can only be called inside a "use cache" function`); NÃO usar `"use cache"` directive (Metadata files retornam `Response` built-in com prototype não-plain — crasha cache boundary). Os 5 callsites de `updateTag('site:<slug>')` em `app/actions/lead-site.ts` (publish/update/archive/restore/sendWhatsApp) expiram o cache transitivamente. Padrão idêntico a `llms.txt/route.ts` (#246). **Gate `isIndexable(site)` → 404** quando null/draft/archived/sem signed_at (diferente do JSON-LD em #211 que sempre injeta — OG ≠ Schema.org: vaza pra social scrapers, não AI crawlers). **SSRF hardening (#244)**: `resolveHeroUrl` chama `isPrivateOrLinkLocalHost` para URLs absolutas antes do `ImageResponse` tentar buscar `visual_identity.hero_url` ou `brand_assets.hero_image_url`; host bloqueado cai no gradient. **Fonte (#245)**: usa `loadGeist()` de `lib/og/load-geist.ts`, lendo `/fonts/geist-600.woff2` do próprio deployment com timeout 1s; sem GitHub raw/CDN e sem embutir o WOFF2 no Edge bundle. **Fallback graceful**: hero ausente → gradient escuro; Geist local fail → system font. `business_name` empty → "Loja de Carros" (não crasha). Alt text textual sem PII. |
| `[slug]/llms.txt/route.ts` | **`llms.txt` para AI crawlers (#214 / Sprint 1 / #S4 — fecha ciclo GEO).** Route handler `GET` retorna Markdown plain text consumido por GPTBot, ClaudeBot, PerplexityBot, Gemini para AI Overviews e respostas AI search. **`Content-Type: text/plain; charset=utf-8`** em 200 E 404 (não usar `notFound()` default que emite HTML — AI crawlers parseariam errado). **Gate `isIndexable(site)` → 404** em null/draft/archived/sem signed_at — IGUAL ao OG image (#213), DIFERENTE do JSON-LD (#211): llms.txt expõe contato direto (telefone, WhatsApp, endereço), privacy by obscurity. **Cache: `export const revalidate = 3600` (ISR 1h) + invalidação transitiva via `getSite()`**. NÃO usar `"use cache"` directive em Route Handlers que retornam `Response` — built-in com prototype não-plain crasha o cache boundary do Next 16 (PR #246 QA blocker). Também NÃO chamar `cacheTag` no handler (Next 16 exige dentro de `"use cache"`). `getSite()` internamente carrega `"use cache"` + `cacheTag('site:<slug>')`; os 5 callsites de `updateTag('site:<slug>')` em `app/actions/lead-site.ts` (update/publish/archive/restore/sign) expiram esse cache, e o `revalidate = 3600` regenera a Response. `Cache-Control` header redundante mas explícito pra CDN externo (CloudFlare). Body via `renderLlmsTxt(variables, slug)` em `lib/sites/llms.ts` — pure, testável isoladamente. Zero PII em logs (slug ok; business_name, phone NÃO). |

## Dependências

- `next/cache` — `cacheTag`, `cacheLife`.
- `next/navigation` — `notFound`.
- `@/lib/supabase/service` — `createServiceSupabase`.
- `@/types/lead-site` — `SiteVariables` (Zod).
- `@/components/sites/SitePage` — wrapper de render.

## Quando atualizar este `CLAUDE.md`

- Nova subrota (`/sites/[slug]/sobre`, etc.) for adicionada.
- Estratégia de cache mudar (TTL, profile diferente).
- Allowlist de service-role for ampliada (precisa justificativa
  documentada no PR).
- Routing por status mudar (V2 410 Gone para archived).
