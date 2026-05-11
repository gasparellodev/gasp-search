# `components/sites/home/` — Seções da Home pública (Phase 7)

## Propósito

Sub-componentes que compõem a Home (`/sites/<slug>`) — issue #162.
Cada arquivo é uma seção isolada da Home com responsabilidade
estreita, consumida em ordem fixa por `<SitePage>`
(`components/sites/SitePage.tsx`).

Diferente do header/footer (compartilhados entre todas as páginas), os
componentes desta pasta só aparecem na rota raiz `/sites/<slug>`. As
páginas filhas (`/sobre`, `/contato`, `/estoque`, `/anuncie`) terão suas
próprias pastas (`about/`, `contact/`, `stock/`, `inventory/`) nas
issues #163-#164.

## Como adicionar

- 1 arquivo por seção, em PascalCase, prefixo `Home` (ex:
  `HomeHero.tsx`, `HomeNewsletter.tsx`).
- **Sempre Server Component.** `import "server-only";` na linha 1 —
  enforça que nenhum componente da Home dispare bundle de cliente.
- **Props com `Pick<SiteVariables, ...>` ou subset explícito.** Não
  passar `variables` inteiro — facilita reuso e testes, e documenta o
  acoplamento da seção com o schema.
- **Cores via `style` inline + `sanitizeHex`.** Tailwind v4 não traduz
  bem `bg-[var(--site-primary)]` em todos os edges — preferir
  `style={{ backgroundColor: sanitizeHex(primary_color) }}`.
- **Imagens com `next/image fill` + `unoptimized`** (CDN externo fora
  do whitelist do `next.config.js`). `alt` text obrigatório e
  descritivo (`Hero — <business_name>`, `Categoria <label>`, etc.).
- **`next/link` para navegação interna.** Bare `<a>` é proibido.
- **Texto IA preservado via `whitespace-pre-line`** — line-breaks da
  IA viram `\n` no texto. Renderização CSS, não HTML.
- **Anti-XSS**: `dangerouslySetInnerHTML` é proibido. `react-markdown`
  é proibido. O texto da IA é sempre renderizado como children React,
  nunca como HTML interpretado.

## Regras de negócio

1. **HomeHero embute `<HomeQuickSearchBar>` (Sprint 4 / #H1 — #221).** O
   CTA legacy do Hero (botão "Acessar estoque completo") foi substituído
   por uma quick search bar (marca + modelo + preço máx). Submit
   redireciona pra `/sites/<slug>/estoque?m=...&model=...&p=...` via
   `serializeQuickSearch` em `lib/sites/stock-search-params.ts` — fonte
   única compartilhada com `/estoque` (#224 / E1).
2. **HomeCategories card** (legacy V1, ainda mantido) →
   `/sites/<slug>/estoque?categoria=<slugify(label)>`. Substituído por
   `<HomeCategoriesCars>` em `SitePage` na Sprint 4 (#221) — 6 cards
   visuais por categoria, link → `/estoque?bodyType=<slug>` per
   `BODY_TYPE_QUERY` canônico (suv/sedan/hatch/pickup/sport/convertible).
   O arquivo `HomeCategories.tsx` permanece como código legado pra
   facilitar rollback se necessário; remoção fica pra cleanup futuro.
3. **HomeForm título PT-BR fixo**: `"Você está procurando algum
   modelo em específico?"` (per spec §15). Não estende
   `SiteVariables` no V1.
4. **HomeEmphasis description**: `whitespace-pre-line` em `<p>`. NUNCA
   `dangerouslySetInnerHTML`.
5. **HomeRecentSales mobile**: `flex snap-x snap-mandatory
   overflow-x-auto`. Desktop vira `md:grid md:grid-cols-3`.
6. **A11y**: cada seção tem `<h2>` (exceto Hero, que tem `<h1>` único
   da página). Imagens têm `alt` não-vazio. Links têm
   `focus-visible:ring`.
7. **HomeHero H1 canônico (Sprint 4 / #221)**: `${business_name} —
   Carros seminovos em ${city}`. Fallback gracioso `${business_name} —
   Carros seminovos` quando `address === null`. Slogan **removido** do
   Hero V2 — `<SiteHeader>` + brand voice já assumiram esse papel.
8. **HomeHero empty state (Sprint 4 / #221)**: quando `hero_image_url`
   é null/vazio, renderiza `linear-gradient(135deg, primary, #0C0C0C)`
   + monogram (1ª letra do `business_name`) centralizado em branco/85%
   opacity. **Nunca branco vazio** — graceful degradation.
9. **HomeCategoriesCars fotos (Sprint 4 / #221)**: consome
   `manifest.categories_urls[CATEGORY_INDEX[slug]]` — array indexado
   por posição (suv=0, sedan=1, hatch=2, pickup=3, esportivo=4,
   conversivel=5). Ordem casa com `lib/sites/visual-identity.ts:CAR_CATEGORIES`.
   Posições ausentes caem em placeholder SVG inline (data URI).
10. **HomeTrustStrip props explícitas (Sprint 4 / #221)**: `rating`,
    `reviewsCount`, `yearsInMarket` recebidos via props (NÃO via
    `SiteVariables` — evita migration). Caller `SitePage` lê
    `lead.rating`/`lead.reviews_count` de `types/database.ts` via join
    em `getSite()`. `years_in_market` lido de
    `SiteVariablesV2.years_in_market` (já existente, optional).

## Arquivos

| Path | Propósito |
|---|---|
| `HomeHero.tsx` | **Hero V2 (Sprint 4 / #H1 — issue #221).** Layout split 6/6 desktop (`md:grid-cols-2`) com `min-h-[90dvh]` mobile (NÃO `vh` — lição sections-catalog). `<h1>` PT-BR canônico `${business_name} — Carros seminovos em ${city}` com `clamp(2.25rem, 6vw, 4.5rem)`; fallback gracioso `Carros seminovos` quando `address === null`. Imagem com `<Image priority fetchPriority="high" sizes="100vw" unoptimized>` — LCP target; `unoptimized` suprime srcset (imagens vêm de CDN externo arbitrário), por isso `sizes` é dead-letter no DOM final mas mantido no source pra clareza. **Empty state** quando `hero_image_url === null`: `linear-gradient(135deg, primary, #0C0C0C)` + monogram (1ª letra do `business_name`) em branco/85% opacity centralizado — NÃO branco vazio (decisão PO #221). Embute `<HomeQuickSearchBar>` (client) abaixo do `<AICitableHero>`. **#214 (Sprint 1 #S4 — GEO):** injeta `<AICitableHero page="home">` imediatamente após o `<h1>`. **#217 (Sprint 2 #A3):** thin — recebe `hero_image_url` já resolvido upstream em `<SitePage manifest>`. |
| `HomeQuickSearchBar.tsx` | **Client (Sprint 4 / #H1 — issue #221).** Form com 3 inputs (marca, modelo, preço máx) + botão "Buscar". Submit redireciona via `useRouter().push()` pra `/sites/<slug>/estoque?m=...&model=...&p=...` (short keys acordadas com #224 E1). Usa `serializeQuickSearch` de `lib/sites/stock-search-params.ts` — fonte única. Botão pinta-se com `primary_color` do lead via `style={{ backgroundColor: sanitizeHex(...) }}`. Labels `<label htmlFor>` visíveis + contraste WCAG AA testado via jest-axe. |
| `HomeTrustStrip.tsx` | **Server-only (Sprint 4 / #H1 — issue #221).** Strip full-bleed (`relative left-1/2 -translate-x-1/2 w-screen`) altura `h-20` (80px) com 4 colunas: Garantia + Vistoria 100 pontos (estáticos), `years_in_market` (dinâmico via prop), `rating + reviewsCount` (dinâmico via props). `role="region" aria-label="Diferenciais"`. **Fallback rules (PO refinement #221):** `years_in_market` undef/null/0 → "Mais de 10 anos"; 1 → "1 ano no mercado"; ≥ 2 → "${N} anos no mercado". `rating`/`reviewsCount` ausentes/`reviewsCount<=0` → fallback "4.8★ 87 reviews". `rating` formatado com `toFixed(1)`. Props explícitas (NÃO `SiteVariables`) — caller `SitePage` lê de `lead.rating`/`lead.reviews_count` via join em `getSite()`. |
| `HomeCategoriesCars.tsx` | **Server-only (Sprint 4 / #H1 — issue #221).** 6 cards 4:3 com foto (`manifest.categories_urls[idx]`) + label overlay para SUV/Sedan/Hatch/Pickup/Esportivo/Conversível. Mobile: scroll horizontal `snap-x snap-mandatory`. Desktop: `grid-cols-6`. Card inteiro é `<Link aria-label="Ver ${plural} no estoque">` → `/estoque?bodyType=<slug>` per `BODY_TYPE_QUERY` canônico (PO refinement #221: suv/sedan/hatch/pickup/sport/convertible — slugs en-US curtos, compartilhados com #224 E1). Fotos via array `manifestCategoriesUrls[idx]` indexado por posição (espelha #216 `ALL_ASSET_SPECS.categoryIndex`); posições ausentes caem em placeholder SVG inline (data URI). |
| `HomeCategories.tsx` | **LEGACY V1.** Grid 3-cols (1-col mobile) com cards-imagem do `variables.home_categories[]` linkando a `/estoque?categoria=<slugify>`. Substituído por `<HomeCategoriesCars>` em `SitePage` na Sprint 4 (#221). Arquivo mantido pra rollback rápido; remover em cleanup futuro. |
| `HomeForm.tsx` | Wrapper Server sobre `<SiteForm>` (Client) que injeta o título canônico da Home + `variant='home'`. |
| `HomeEmphasis.tsx` | "Em destaque" 2-cols: imagem left + card alabaster (rounded 25px) com title/car_name/description (`pre-line`). |
| `HomeRecentSales.tsx` | 3 cards horizontais: grid desktop / scroll-snap mobile. Cada card: imagem + car_name + `CheckCircle`. |

## Boundary client/server

```
HomeHero (server) ───┐
                     └─ embute <HomeQuickSearchBar> (client) ── useRouter
HomeTrustStrip (server) ─── pure server
HomeCategoriesCars (server) ─── pure server
HomeCategories (server, legacy) ─── pure server
HomeForm (server) ───┐
                     └─ delega ao <SiteForm> (client) ── react-hook-form
HomeEmphasis (server) ─── pure server
HomeRecentSales (server) ─── pure server
```

`HomeHero` é server mas embute o `<HomeQuickSearchBar>` (Client) por
composição direta — o caller (`SitePage`) não precisa saber dessa
boundary; o teste é via `getByTestId("home-quick-search-bar")`.

## Dependências

- `next/image` + `next/link` + `next/navigation.useRouter` (Quick Search).
- `lucide-react@^1.14` (`ChevronRight`, `CheckCircle`, `ShieldCheck`,
  `BadgeCheck`, `Building2`, `Star`).
- `@/lib/sites/sanitize.sanitizeHex` — defesa em profundidade pra
  cores hex.
- `@/lib/sites/stock-search-params` — `serializeQuickSearch`/
  `parseQuickSearch` shared com #224 (E1).
- `@/lib/utils/slug.slugify` — gera o querystring de
  `?categoria=<slug>` (legacy `HomeCategories`).
- `@/lib/sites/site-assets.SITE_ASSETS` — `hero.texture` (decorativa
  fixa) e `hero.demoCarCutout` (fallback legacy). HomeHero V2 (#221)
  não usa mais o demoCarCutout — empty state é gradient + monogram.
- `@/types/lead-site.SiteVariables(V2)` — tipos do payload (campos
  consumidos via `Pick`).
- `../SiteForm` — wrapper client do form de captura.
- `../AICitableHero` — passage-citable AI block (#214).

## Quando atualizar este `CLAUDE.md`

- Nova seção da Home (`HomeNewsletter`, `HomeStats`, etc.).
- Mudança na ordem das seções em `<SitePage>`.
- Mudança no contrato de props de qualquer Home component.
- Novo ramo de boundary client/server (ex: ilha interativa dentro de
  `HomeHero`).
