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
5. **HomeRecentArrivals mobile**: `flex snap-x snap-mandatory
   overflow-x-auto`. Desktop vira `md:grid md:grid-cols-4` (até 8 cards).
   Empty state (`cars.length === 0`) → trust signal + WhatsApp CTA `general`,
   nunca seção em branco. **Substitui** o legacy `HomeRecentSales`
   (Sprint 4 / #H2 — issue #222).
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
| `HomeRecentArrivals.tsx` | **Server-only (Sprint 4 / #H2 — issue #222).** Substitui legacy `HomeRecentSales`. Header `<h2>Recém-chegados</h2>` + CTA "Ver estoque completo" → `/sites/<slug>/estoque`. Renderiza até 8 `<CarCard>` de `variables.cars.slice(0, 8)` (PO spec ambiguity #10 resolvida com `cars` — `recent_sales` schema só tem 3 entries com car_name+image, incompat com anatomia full CarCard). Mobile: scroll horizontal snap; desktop `md:grid-cols-4`. **Empty state** (`cars.length === 0`) → trust signal + WhatsApp CTA template `general`. |
| `HomeFinancingWidget.tsx` | **Client (Sprint 4 / #H2 — issue #222).** Diferencial competitivo nº 2 — calculadora INLINE. Split 6/6 desktop: copy + `<BanksStrip>` à esquerda; form + output à direita. Inputs: price text mask vanilla (`useState` + `formatBRL`, sem `react-input-mask`/`imask`), slider entrada 0-50% step 5%, select prazo `{12, 24, 36, 48, 60}`. Output em `aria-live="polite"` com `min-height` fixo (layout shift 0). Edge cases: price=0 → "—"; downPaymentPct=100 → "Sem financiamento". `useDeferredValue` em vez de `setTimeout` (React 19 idiom). DISCLAIMER_TEXT obrigatório (CDC + Bacen) abaixo do output. CTA → `buildWhatsAppLink({template: 'financing', ...})` com `finance` context. |
| `HomeTradeinWidget.tsx` | **Server-only (Sprint 4 / #H2 — issue #222).** Split 6/6 desktop: foto editorial + h2 + body + 2 CTAs. **Foto chain** (PO decision B1): `manifestAboutUrl ?? aboutImageUrl ?? '/assets/about/porsche-model.png'` — não há slot `tradein_editorial` no `VisualIdentityManifest`, reusamos `about_url` (zero impacto no pipeline AI). CTAs: "Avaliar meu carro" → `/sites/<slug>/anunciar` (primary preto) + "WhatsApp" → `buildWhatsAppLink({template: 'tradein', ...})` (outlined verde). |
| `HomeWarrantySection.tsx` | **Server-only (Sprint 4 / #H3 — issue #223).** Split editorial 6/6 desktop: foto esquerda + 4 bullets PT-BR (`<CheckCircle2 />` Lucide) à direita. **Foto fallback chain** (PO decision — `VisualIdentityManifest` v1 NÃO tem `warranty_editorial`): `manifestAboutUrl ?? aboutImageUrl ?? FALLBACK_IMAGE_URL`. h2 `"Por que comprar com a ${business_name}"`. Bullets canônicos vivem em `lib/sites/warranty-bullets.ts` (single source of truth — mudanças requerem PO sign-off). |
| `HomeProcess3Steps.tsx` | **Server-only (Sprint 4 / #H3 — issue #223).** 3 cards horizontais (desktop) / stack vertical (mobile) com `<Search />`/`<FileText />`/`<KeyRound />` Lucide + h3 + body 2-3 linhas. Conteúdo hardcoded em `lib/sites/process-steps-template.ts` ("Escolha seu carro" / "Aprovação simples" / "Leve pra casa"). Eyebrow "Como funciona" + h2 "Comprar o seu próximo carro em 3 passos". Numbering `01/02/03` em tabular-nums. |
| `HomeBanksPartners.tsx` | **Server-only (Sprint 4 / #H3 — issue #223).** Wrapper sobre `<BanksStrip>` shared (#G2 / #219) com h2 `"Bancos parceiros para financiar seu próximo carro"` + caption. Reuso da strip de bancos parceiros existente — esta section adiciona contexto editorial pra Home (`<BanksStrip>` por si só não tem heading semântico). |
| `HomeTestimonialsGrid.tsx` | **Server-only (Sprint 4 / #H3 — issue #223).** 3 cards lendo `variables.testimonials[]` v2 (`slice(0, 3)`). Quando vazio/undefined cai em fallback hardcoded PT-BR neutros (Maria S./São Paulo, João P./Curitiba, Ana C./BH — PO decision NÃO usar "JBL" ou nomes reais de outras lojas). Avatar via Monogram inline (1ª letra do nome, sem Vercel Blob roundtrip — reuso conceito de `buildMonogramLogo` em `brand-assets.ts`). Stars com `<Star fill="currentColor" />` Lucide. |
| `HomeFAQSection.tsx` | **Client (Sprint 4 / #H3 — issue #223).** Radix Accordion 8 perguntas hardcoded em `lib/sites/faq-template.ts` (range PO refinement: 7-10). `ChevronDown` rotaciona via `data-state="open"` CSS selector. **IMPORTANTE — SEM JSON-LD `FAQPage` Schema:** DESIGN.md anti-pattern explícito; Google penaliza FAQPage em business sites desde 2023. Test (`HomeFAQSection.test.tsx`) checa que `<script type="application/ld+json">` NÃO contém "FAQPage". |
| `HomeGoogleReviewsEmbed.tsx` | **Server-only V1 (Sprint 4 / #H3 — issue #223).** Big rating + count props upstream propagados (`<SitePage rating>`/`<SitePage reviewsCount>` que vêm de `lead_rating`/`lead_reviews_count` no join `getSite()`). Fallback pareado 4.8/87 quando NULL ou rating sem reviewsCount (consistente com `<HomeTrustStrip>` #221). 3 placeholder reviews PT-BR genéricos ("Cliente verificado"). Caption + link externo "Ver todas no Google" com `target="_blank" rel="noopener noreferrer"`. **V2 follow-up** (comentado inline): fetch reviews reais via Google Places API + cache 24h ISR. |
| `HomeContactFormQuick.tsx` | **Client (Sprint 4 / #H3 — issue #223).** Lead capture principal — conversão final da Home. **Exceção visual intencional** (`bg-foreground text-background` — dark card destacado, documentado em `components/sites/CLAUDE.md`). **Anti-bot:** (1) honeypot `<input name="website">` em `position:absolute; left:-9999px`, `tabIndex={-1}`, `aria-hidden`, `autocomplete="off"`. (2) Min-time gate via state `renderedAt` (setado em `useEffect`); submit < 2000ms é silenciosamente descartado server-side (ver `app/actions/site-form.ts`). RHF + zodResolver (`SiteFormSchema` estendido com `message`). LGPD checkbox required com link `/sites/${slug}/lgpd` (`target=_blank`). Submit chama Server Action `submitSiteForm(siteId, values, { honeypot, renderedAt })`. **Feature flag** `NEXT_PUBLIC_SITE_FORMS_ENABLED === '1'` (default off) — componente retorna `null` quando OFF (defesa em profundidade; caller `<SitePage>` também checa). Focus management via `setFocus` da RHF pós-submit com erro. Toast PT-BR `"Mensagem enviada! Em breve entraremos em contato."` em sucesso. |

## Boundary client/server

```
HomeHero (server) ───┐
                     └─ embute <HomeQuickSearchBar> (client) ── useRouter
HomeTrustStrip (server) ─── pure server
HomeCategoriesCars (server) ─── pure server
HomeCategories (server, legacy) ─── pure server
HomeRecentArrivals (server) ─── compõe <CarCard> (server) — pure server
HomeFinancingWidget (CLIENT) ── useState + useDeferredValue (real-time calc)
HomeTradeinWidget (server) ─── pure server
HomeForm (server) ───┐
                     └─ delega ao <SiteForm> (client) ── react-hook-form
HomeEmphasis (server) ─── pure server
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
