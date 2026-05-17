# Frente 03 — SEO Infra

> Sub-spec de [`site-irresistivel-northstar.md`](./2026-05-17-site-irresistivel-northstar.md). Foco em **infraestrutura técnica de SEO** dos sites públicos. Independente das outras frentes — pode rodar em paralelo.

| Campo | Valor |
|---|---|
| Status | Draft |
| Tipo | Feature técnica multi-issue |
| Duração estimada | 6-8 dias úteis |
| Depende de | Nada (infra) |
| Bloqueia | Parte de #04 GEO (schema cobre semântica que llms.txt referencia) |

---

## 1. Problema

Estado atual da SEO infra dos sites públicos:

| Componente | Estado |
|---|---|
| `robots.ts` (raiz) | ✅ OK — 11 AI bots + Bingbot allowlist (PR #212) |
| `app/sites/[slug]/llms.txt/route.ts` | ✅ OK — per-site (PR #214) |
| `app/sites/[slug]/opengraph-image.tsx` | ✅ OK (PR #213) |
| `generateMetadata` por rota | ✅ OK — todas as 7 rotas |
| `buildSiteMetadata` helper | ✅ OK |
| **Sitemap global dos sites** | ❌ AUSENTE — Search Console não consegue descobrir sites |
| **Sitemap per-site** | ❌ AUSENTE |
| **Schema LocalBusiness/AutoDealer** | ⚠️ PARCIAL — `AICitableHero` injeta básico, falta full LD-JSON |
| **Schema Vehicle por carro** | ❌ AUSENTE — `/estoque/[carSlug]` sem JSON-LD |
| **Schema FAQPage** | ❌ AUSENTE — `<SiteFAQ>` renderiza mas sem markup |
| **Schema BreadcrumbList** | ❌ AUSENTE — `<Breadcrumb>` visual sem JSON-LD |
| **IndexNow** | ⚠️ PARCIAL — env `INDEXNOW_KEY` existe (#232), dispara em `signLeadSite` apenas |
| **Canonical** | ⚠️ Inferido pelo Next via `metadataBase`; sem `canonical` explícito por rota |
| **Internal linking** | ❌ Sem automação — links manuais no header/footer |

---

## 2. Objetivo

1. **Sitemap completo** descoberto pelo Search Console em < 24h após publicação de cada site.
2. **Schema rich** validado por Google Rich Results Test pra todas as 4 entidades principais (LocalBusiness/AutoDealer, Vehicle, FAQPage, BreadcrumbList).
3. **IndexNow proativo** em mudanças de estoque (carro novo publicado / preço alterado).
4. **Canonical explícito** evitando duplicação por query string / trailing slash / capitalization.
5. **Internal linking** automatizado entre Home → Estoque → CarDetail → Categorias.

---

## 3. Issues propostas

### #S1 — Sitemap global dos sites (`app/sites/sitemap.ts`)

**Problema:** `app/robots.ts` aponta `sitemap` para URL absoluto, mas o arquivo destino não existe.

**AC:**
- [ ] `app/sites/sitemap.ts` exporta `MetadataRoute.Sitemap` listando TODOS os sites com `status IN ('published', 'sent')` e `signed_at IS NOT NULL`.
- [ ] Cada entry tem `url`, `lastModified` (`updated_at` do `lead_sites`), `changeFrequency: 'weekly'`, `priority: 0.8`.
- [ ] Query Supabase via service role (server-only).
- [ ] Cache: `export const revalidate = 3600` + `cacheTag('sitemap:sites')`.
- [ ] `app/robots.ts` atualizado pra incluir esta URL no `sitemap` (já estava — verificar).
- [ ] Testes: vitest com mock de Supabase verifica filtros e formato de URL.
- [ ] Quota: paginação Supabase se > 1000 leads (Next aceita até 50k URLs/sitemap; usar sitemap index se ultrapassar).

**Skills:** TDD obrigatório. `seo-sitemap` validation.

---

### #S2 — Sitemap per-site (`app/sites/[slug]/sitemap.ts`)

**Problema:** Sitemap global lista só Home; carros e sub-páginas não são descobertos.

**AC:**
- [ ] `app/sites/[slug]/sitemap.ts` lista 7 URLs fixas (`/`, `/sobre`, `/contato`, `/anunciar`, `/estoque`, `/lgpd`) + dinâmicas (`/estoque/[carSlug]` por cada `car` do lead).
- [ ] `lastModified` por carro vem do `cars.updated_at`.
- [ ] Gate: site `draft`/`archived` retorna sitemap vazio (mantém privacy by obscurity).
- [ ] Cache: `revalidate = 3600` + `cacheTag('sitemap:site:<slug>')`.
- [ ] Sitemap global referencia sitemap per-site como `<sitemap><loc>...</loc></sitemap>` (sitemap index pattern) — TBD durante implementação se é melhor inline ou indexar.
- [ ] Testes: vitest cobre 3 estados (published com 5 carros, published sem carros, draft).

**Skills:** TDD obrigatório.

---

### #S3 — Schema LocalBusiness + AutoDealer (Home)

**Problema:** `<AICitableHero>` injeta apenas dataset minimal. Google Rich Results Test reprova como "incomplete".

**AC:**
- [ ] `lib/sites/schema/local-business.ts` exporta `buildLocalBusinessSchema(variables, site)` retornando JSON-LD válido `@type: ["LocalBusiness", "AutoDealer"]`.
- [ ] Campos: `name`, `image`, `url`, `telephone`, `address` (PostalAddress), `geo` (GeoCoordinates se disponível), `openingHoursSpecification`, `priceRange`, `sameAs` (sociais), `aggregateRating` (se reviews).
- [ ] Injetado em `app/sites/[slug]/page.tsx` via `<script type="application/ld+json">` server-rendered.
- [ ] Validado por `seo-schema` (rich results test) — output do teste cola no PR.
- [ ] Defesa: `sanitizeHex`/`sanitizeText` em campos textuais; `JSON.stringify` com `replacer` que escapa `</script>`.
- [ ] Backward compat: `<AICitableHero>` continua existindo mas seu schema vira derived do helper.

**Skills:** `seo-schema` obrigatório. TDD.

---

### #S4 — Schema Vehicle por carro

**AC:**
- [ ] `lib/sites/schema/vehicle.ts` exporta `buildVehicleSchema(car, site)` retornando `@type: Vehicle`.
- [ ] Campos: `name`, `brand`, `model`, `vehicleModelDate` (ano), `mileageFromOdometer`, `bodyType`, `fuelType`, `vehicleTransmission`, `numberOfDoors`, `color`, `vehicleIdentificationNumber` (se permitido — geralmente NÃO por privacy), `offers` (Price + availability + seller→LocalBusiness).
- [ ] Injetado em `app/sites/[slug]/estoque/[carSlug]/page.tsx`.
- [ ] Imagens (`image[]`) do carro com URLs absolutos.
- [ ] Helper unitário 100% coverage.
- [ ] Validado por `seo-schema` + Google Rich Results.

---

### #S5 — Schema FAQPage + BreadcrumbList

**AC:**
- [ ] `lib/sites/schema/faq.ts` exporta `buildFAQSchema(faqs[])` — `@type: FAQPage`.
- [ ] `<SiteFAQ>` já renderiza FAQ visualmente; novo helper injeta JSON-LD na mesma rota.
- [ ] `lib/sites/schema/breadcrumb.ts` exporta `buildBreadcrumbSchema(items[])` — `@type: BreadcrumbList`.
- [ ] `<Breadcrumb>` consome helper internamente; rotas `/sobre`, `/contato`, `/estoque`, `/estoque/[car]` injetam o schema.
- [ ] Validado por `seo-schema`.

---

### #S6 — Canonical explícito + Open Graph robusto

**Problema:** Next infer canonical via `metadataBase`; query strings + trailing slash criam duplicação potencial.

**AC:**
- [ ] `buildSiteMetadata` aceita `pathname` (já aceita) e injeta `alternates.canonical` absoluto.
- [ ] Middleware ou route handler que normaliza: força lowercase, remove trailing slash (exceto root), redireciona 308.
- [ ] Open Graph: `og:locale = pt_BR`, `og:type = website` (Home), `og:type = product` (CarDetail), `og:image:width/height` declarados.
- [ ] Twitter Card: `summary_large_image` com `twitter:site` opcional.
- [ ] Testes: rota `/sites/<slug>/estoque/<car>?foo=bar` retorna canonical sem query.

**Skills:** `seo-technical`.

---

### #S7 — IndexNow proativo em mudanças de estoque

**Problema:** IndexNow dispara só no `signLeadSite`. Carro novo / preço atualizado não notifica Bing/Yandex.

**AC:**
- [ ] Hook em Server Action `createCar`/`updateCar` (ou equivalente) dispara `submitIndexNow(urls[])`.
- [ ] Batching: agrega até 10s ou 10 URLs (whichever first) pra economizar requests.
- [ ] Retry logic: falha de IndexNow não bloqueia ação principal; log estruturado.
- [ ] Gate: `INDEXNOW_KEY` ausente → noop silencioso.
- [ ] Testes: vitest mocka fetch e valida payload.

---

### #S8 — Internal linking automation

**Problema:** Header/footer links são fixos; não há "carros similares" / "outros desta categoria" cross-linking.

**AC:**
- [ ] `<CarDetailRelatedCars>` novo componente: lista 4 carros similares (mesma categoria, faixa de preço ±20%).
- [ ] `<EstoqueByCategoryLink>` na Home: para cada categoria principal com ≥ 3 carros, gera card linkando pra `/estoque?categoria=X`.
- [ ] `app/sites/[slug]/estoque/page.tsx` aceita query param `?categoria=` e filtra.
- [ ] Anchor text usa `<modelo> <ano>` (long-tail SEO) em vez de "Ver detalhes".
- [ ] `rel="next"`/`rel="prev"` em listagens paginadas.

---

### #S9 — Core Web Vitals hardening

**Problema:** LCP/INP não medidos sistematicamente por PR.

**AC:**
- [ ] CI job `lighthouse-ci` configurado em `.github/workflows/lighthouse.yml`.
- [ ] Roda contra preview Vercel após cada PR que toca `app/sites/` ou `components/sites/`.
- [ ] Budgets: LCP ≤ 2500ms, INP ≤ 200ms, CLS ≤ 0.1, TBT ≤ 200ms.
- [ ] PR é bloqueada se budget regressar > 10%.
- [ ] Componentes pesados (HomeHeroBackground com Image unoptimized) auditados; migrar pra `next/image` sized quando possível.

**Skills:** `vercel:performance-optimizer`.

---

### #S10 — Documentação SEO + dashboard

**AC:**
- [ ] `docs/SEO-PLAN.md` atualizado com nova arquitetura schema.
- [ ] `app/sites/CLAUDE.md` documenta sitemap + schema convention.
- [ ] `lib/sites/schema/CLAUDE.md` novo, com pattern + exemplo de novo helper.
- [ ] Dashboard interno em `(app)/admin/seo-health/page.tsx` opcional V2 — fica como issue futura.

---

## 4. Critérios de saída

- [ ] 10 issues fechadas.
- [ ] Google Rich Results Test passa pras 4 entidades em ≥ 3 sites diferentes.
- [ ] Search Console mostra sitemap descoberto e indexado em < 48h após publicação de novo site (validar com 1 site piloto).
- [ ] Lighthouse mobile P75 ≥ 95 SEO em sites publicados.

---

## 5. Riscos & mitigações

| Risco | Mitigação |
|---|---|
| Schema injection (XSS via `</script>` em campo de texto) | `JSON.stringify` com replacer + sanitizeText helper. Test case com payload malicioso. |
| Sitemap > 50k URLs | Sitemap index pattern. V1 não atinge esse volume. |
| IndexNow rate limit (10k URLs/dia free) | Batching + debounce de 10s. |
| Canonical normalization quebra deep links existentes | 308 redirects preservam SEO equity. Teste e2e cobre. |
| Lighthouse CI flaky em preview Vercel cold start | Warm-up request antes da auditoria. |

---

## 6. Fora de escopo (V2+)

- Multi-idioma / hreflang (lead ainda é PT-BR only).
- Sitemap de imagens (V2 quando tivermos volume).
- SEO A/B testing (Search Console split tests).
- Rich snippets de eventos / promoções (V2 quando lead criar promoções).
