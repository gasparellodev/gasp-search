# SEO-PLAN — Gasp Search / Site Generator (Phase 7)

> Documento vivo. Atualizar sempre que uma nova frente SEO for concluída ou
> estratégia mudar. Detalhes de implementação ficam nos `CLAUDE.md` das pastas
> afetadas; aqui fica a **visão de produto e as decisões arquiteturais**.

---

## Contexto de produto

Os sites públicos gerados em `/sites/<slug>` são **mini-sites de concessionárias
seminovos** — cada lead recebe um site dedicado após publicação (`signed_at`).
O objetivo SEO é garantir que esses sites sejam indexados, descobertos por
crawlers AI, e gerem citações orgânicas para o lead.

Audiência primária: compradores de carros seminovos no Brasil buscando marcas,
modelos e faixas de preço via Google, AI Overviews (SGE), ChatGPT, Perplexity.

---

## Decisões estratégicas permanentes

### 1. Schema.org sempre injetado — mesmo em `noindex`

Sites em draft/archived recebem `robots: noindex` mas continuam com JSON-LD
injetado. Razão: AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Gemini)
consomem JSON-LD ignorando `robots:noindex` — são bots de treinamento, não
bots de indexação. Só o OG image e o `llms.txt` têm gate `isIndexable`.

### 2. FAQPage JSON-LD é anti-pattern — não fazer

Google penaliza FAQPage em business sites desde 2023. `<HomeFAQSection>` e
`<DetailFaqVehicle>` renderizam FAQ visual mas **sem** markup JSON-LD
`FAQPage`. Documentado em `lib/sites/faq-template.ts` e
`lib/sites/detail-faq-templates.ts`. Toda nova superfície de FAQ deve respeitar
essa decisão.

### 3. `llms.txt` gateado por `isIndexable`

Diferente do JSON-LD, o `llms.txt` expõe telefone comercial, endereço e
WhatsApp do negócio — privacy by obscurity exige gate. Sites não-publicados
retornam 404 com `Content-Type: text/plain` (não HTML, para AI crawlers
parsearem corretamente).

### 4. IndexNow proativo em vez de reativo

Não depender apenas do crawl orgânico do Bingbot/Yandex. Toda mutação relevante
de estoque (carro publicado, preço alterado, assinatura do site) dispara
IndexNow para descoberta em < 1h.

---

## SEO Infra v1 (Phase 7 Sprint 1 — 2026-05)

Entregue nas issues #211–#214 do Sprint 1:

| Componente | Status | Issue |
|---|---|---|
| `robots.ts` global | ✅ 11 AI bots + Bingbot allowlist | #212 |
| `generateMetadata` por rota | ✅ canonical + hreflang + robots toggle | #199 |
| `buildSiteMetadata` helper | ✅ city-aware titles, 160-char description | #199 |
| Schema.org LocalBusiness/AutoDealer | ✅ `buildSitewideGraph` no layout | #211 |
| Schema.org WebSite | ✅ `buildWebSiteSchema` com `publisher @id` | #213 |
| Schema.org Vehicle + BreadcrumbList | ✅ `<CarDetailSection>` + `<SiteSchema>` | #211 |
| OG image dinâmica | ✅ `opengraph-image.tsx` edge 1200×630 | #213 |
| `llms.txt` per-site | ✅ Markdown plain-text AI-crawlable | #214 |
| `notifyIndexNow` direto | ✅ hook em `signLeadSite()` | #232 |

---

## SEO Infra v2 (2026-05-17 — Frente 03)

A Frente 03 do epic "Site Irresistível" entregou 4 capabilities de infra que
fecham os gaps técnicos da Phase 7.

### Sitemap

- **Global** (`app/sites/sitemap.ts`): lista todos os sites com
  `status IN ('published', 'sent')` AND `signed_at IS NOT NULL`.
  Defense in depth via `.filter(isIndexable)` após DB read. Cache
  `revalidate=3600` + `cacheTag('sitemap:sites')`. PR #392.
- **Per-site** (`app/sites/[slug]/sitemap.ts`): 6 rotas estáticas
  (`/`, `/sobre`, `/contato`, `/anunciar`, `/estoque`, `/lgpd`) + carros
  dinâmicos de `variables.cars[]`. Gate via `isIndexable(site)` — retorna
  `[]` pra draft/archived/missing/unsigned. PR #392.

Search Console submission: `https://<NEXT_PUBLIC_APP_URL>/sites/sitemap.xml`
(declarado em `app/robots.ts`).

### Schema.org JSON-LD

Pattern estabelecido em sprints anteriores (#211, #213), validado e
extendido em Frente 03:

- `lib/sites/schema/index.ts` — barrel com 7 builders (`buildLocalBusinessSchema`,
  `buildAutoDealerSchema`, `buildOrganizationSchema`, `buildWebSiteSchema`,
  `buildVehicleSchema`, `buildBreadcrumbSchema`, `buildSitewideGraph`).
- Injeção via `<SiteSchema>` em `app/sites/[slug]/layout.tsx` (sitewide graph)
  e `app/sites/[slug]/estoque/[carSlug]/page.tsx` (Vehicle + Breadcrumb).
- **Defense XSS**: `escapeJsonLd(value)` em `lib/sites/schema/index.ts` usa
  Unicode escapes (`<` / `>` / `&`) que mantêm round-trip
  válido em `JSON.parse` enquanto bloqueiam breakout `</script>`. PR #392.
- **URL safety**: `safeAbsoluteUrl(input)` whitelista `http:`/`https:` apenas
  (`javascript:` / `data:` retornam `null`). PR #392.

**Anti-pattern intencional:** `FAQPage` JSON-LD NÃO é emitido em business
sites — Google penaliza desde 2023 (documentado em `lib/sites/faq-template.ts`
e `lib/sites/detail-faq-templates.ts`).

### Canonical normalization

- `lib/sites/canonical.ts` (pure / Edge-safe) — `normalizeCanonical(pathname)`
  retorna forma canônica (`lowercase` + sem trailing slash) ou `null`.
- `proxy.ts` (raiz, Next 16) — intercepta `/sites/*` não-canônicos com
  redirect **308** antes de delegar a `updateSession()`. Query string
  preservada via `request.nextUrl.clone()`. PR #393.

### IndexNow

- `lib/seo/indexnow.ts` — `notifyIndexNow(urls)` direto (existing). Usado por
  `signLeadSite()` no fluxo de assinatura.
- `lib/seo/indexnow-queue.ts` (#367 / PR #394) — `enqueueIndexNow(url)` +
  `flushIndexNowQueue()` em fila singleton por processo. Coalece mutações
  rápidas (ex: upload em lote de 20 carros) em 1-2 POSTs IndexNow em vez
  de N. Auto-flush por tamanho (≥10) ou tempo (10s). Hook em
  `updateLeadSiteVariables` quando `patch.cars` muda.

### Lighthouse CI

- `.github/workflows/lighthouse.yml` — soft-gate workflow em PRs que tocam
  `app/sites/**`, `components/sites/**`, `lib/sites/**`.
- `lighthouserc.json` — budgets: perf ≥ 0.90 (error), SEO ≥ 0.95 (error),
  a11y ≥ 0.95 (error), LCP ≤ 2500ms, CLS ≤ 0.1, TBT ≤ 200ms.
- Soft-gate: workflow no-ops quando `VERCEL_TOKEN`/`VERCEL_PROJECT_ID`
  ausentes — não bloqueia PRs em forks/dependabot. PR #395.

---

## GEO / AI Visibility (Frente 04 — 2026-05-17)

Entregue nas issues do Sprint GEO (PR #396–#402):

| Componente | Status | PR |
|---|---|---|
| `llms.txt` v2 (facts enriched) | ✅ | #396 |
| `llms-full.txt` route handler | ✅ | #396 |
| `generateFAQ` Server Action (AI) | ✅ structured FAQ sem FAQPage JSON-LD | #400 |
| `AICitableHero` microdata polish | ✅ `itemscope`/`itemprop` markup | #397 |
| Brand mention monitoring script | ✅ `scripts/brand-mentions.ts` | #402 |

**Regra GEO permanente:** nenhuma superfície nova de FAQ deve emitir
`FAQPage` JSON-LD — ver decisão estratégica #2 acima.

---

## Roadmap V2 (não commitado)

- **Sitemap index** se lead_sites ultrapassar 1000 entries (Next suporta 50k
  por sitemap file; hoje usa paginação Supabase direta).
- **SearchAction** em `WebSite` schema quando `/estoque` ganhar query
  filterable por URL (`?q=...` + canonical pattern estabelecido).
- **`hreflang` pt-BR / pt-PT** quando internacionalização for planejada.
- **Core Web Vitals field data** via CrUX API pra monitoramento contínuo.
- **IndexNow Redis queue** para produção multi-instância (hoje singleton
  in-process — não compartilhado entre workers serverless).

---

## Referências

- Spec Frente 03: `docs/superpowers/specs/2026-05-17-site-irresistivel-03-seo-infra.md`
- Spec Frente 04 GEO: `docs/superpowers/specs/2026-05-17-site-irresistivel-04-geo-ai.md`
- Schema builders: `lib/sites/schema/CLAUDE.md`
- Sitemap routes: `app/sites/CLAUDE.md` → seção "Sitemap & SEO"
- Canonical: `lib/sites/canonical.ts` + `proxy.ts` (raiz)
- IndexNow queue: `lib/seo/indexnow-queue.ts`
- Lighthouse config: `lighthouserc.json` + `.github/workflows/lighthouse.yml`
