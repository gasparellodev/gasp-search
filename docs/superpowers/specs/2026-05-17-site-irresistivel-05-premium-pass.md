# Frente 05 — Premium Pass por página

> Sub-spec de [`site-irresistivel-northstar.md`](./2026-05-17-site-irresistivel-northstar.md). Auditoria visual + react-best-practices + microcopy + conversão em cada uma das 7 rotas públicas dos sites.

> **📊 Status update 2026-05-17 (post-discovery).** Discovery confirmou que ~85% dos componentes propostos JÁ EXISTEM com nomes canônicos diferentes ou foram redesenhados recentemente nos PRs #287/#288/#231/#258/#282/#227/#285/#336/#338/#339/#340/#341/#342. **11 de 13 issues fechadas como `not planned`/redundantes.** Trabalho real restante (3 issues): (#P5 reescopado) criar `AboutTimeline` + `AboutTeam`; (#P10) `/lgpd` nunca teve design pass dedicado; (#P12) motion choreography cross-page (foundation em `motion.ts` existe via WP1 #290, falta orquestração entre rotas).

| Campo | Valor |
|---|---|
| Status | Draft |
| Tipo | Refactor + polish multi-issue (a maior frente) |
| Duração estimada | 12-18 dias úteis |
| Depende de | #01 Competitive (heurísticas), #02 Variations (deve cobrir os 3 temas), #03 SEO Infra (schema disponível) |
| Bloqueia | nada (fecha a epic) |

---

## 1. Problema

Componentes existem e funcionam, mas:

- **Não foram revisados sob ótica competitiva.** O hero ganhou redesign "Cinematic Dark" (PR #340), mas outras páginas continuam no padrão MVP de #205-#217.
- **Microcopy genérico.** Headlines como "Encontre seu carro ideal" se repetem em todo lugar; sem personalidade.
- **Conversion points fragmentados.** WhatsApp CTA aparece 4× em alguns layouts e 0× em outros.
- **Acessibilidade não-auditada por página.** Bug #342 (white-on-yellow) prova que sem audit visual, contraste regride.
- **React patterns inconsistentes.** Alguns componentes têm `'use client'` desnecessário, falta de `key` estável, props drilling profundo.

---

## 2. Objetivo

Cada uma das 7 rotas públicas atravessa um **premium pass** com 6 entregas:

1. **Visual quality**: hierarquia tipográfica, ritmo, foco visual, motion choreographed.
2. **Microcopy**: PT-BR contextual ao negócio, sem genérico. Patterns de #G6.
3. **Conversion**: 1 CTA primário claro por viewport; secondaries não competem.
4. **A11y**: WCAG AA contraste + ARIA + keyboard nav + focus visible.
5. **Performance**: LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms na rota.
6. **React quality**: server-first, sem `'use client'` desnecessário, keys estáveis, memoization onde mede.

E cada rota termina com **screenshots before/after** + Lighthouse antes/depois no PR.

---

## 3. Mapa das 7 rotas e issues propostas

### Rota `/` (Home)

#### #P1 — Premium Pass: Home — Above the fold

**Componentes tocados:** `HomeHero`, `HomeQuickSearchBar`, `HomeTrustStrip`, `HomeHeroBackground`, `HomeHeroLockup`, `HomeHeroMonogram`.

**AC:**
- [ ] `frontend-design:frontend-design` produz mockup pros 3 temas (cinematic-dark já existe pós-#340; editorial-light + showroom-minimal novos).
- [ ] QuickSearchBar: filtro principal (marca/modelo + faixa de preço) com submit que abre `/estoque?...`.
- [ ] TrustStrip: 4 trust signals contextuais (anos no mercado, carros vendidos, garantia, parceiros). Microcopy de #G6.
- [ ] Hero CTA primário: WhatsApp ou agendar visita; secundário: "Ver estoque completo".
- [ ] Microcopy hero: usa pattern "A <name> vende <tipo> em <bairro>." (gerado IA).
- [ ] A11y: contraste validado nos 3 temas; focus visible em todo input/link.
- [ ] CWV: LCP da Home ≤ 2.5s (medido).
- [ ] `vercel:react-best-practices` audit.

**Skills:** todas do stack oficial.

---

#### #P2 — Premium Pass: Home — Categories + Recent Arrivals

**Componentes tocados:** `HomeCategoriesCars`, `HomeRecentArrivals`.

**AC:**
- [ ] Categorias adaptadas por tema (#02): cinematic = 3-col asimétrico com gradient mask; editorial = 4-col uniforme com white card; minimal = 6-col enxuto.
- [ ] RecentArrivals: 6 carros mais recentes com aspect ratio consistente; "Ver mais" link para `/estoque`.
- [ ] Cada card de carro: `<article>` semântico + schema Vehicle (vem do #S4); alt text rico.
- [ ] Hover state distinto por tema.
- [ ] Empty state desenhado quando lead ainda não tem carros.

---

#### #P3 — Premium Pass: Home — Process, Warranty, Testimonials, Reviews

**Componentes tocados:** `HomeProcess3Steps`, `HomeWarrantySection`, `HomeTestimonialsGrid`, `HomeGoogleReviewsEmbed`.

**AC:**
- [ ] Process3Steps com ícones distintos por tema; copy curta factual ("1. Escolha online. 2. Agende visita. 3. Saia de carro novo.").
- [ ] WarrantySection com bullet de garantias + selo visual; link pra `/sobre#garantia`.
- [ ] TestimonialsGrid: 3-6 testimonials reais; sem placeholder em prod.
- [ ] GoogleReviewsEmbed: respeita LGPD (não load até consent); usa fallback estático com 1-3 reviews.
- [ ] Microcopy validada por `seo-content` (E-E-A-T).

---

#### #P4 — Premium Pass: Home — Banks, FAQ, Contact Banner, Contact Form

**Componentes tocados:** `HomeBanksPartners`, `HomeFAQSection`, `HomeContactBanner`, `HomeContactFormQuick`.

**AC:**
- [ ] BanksPartners: logos com altura uniforme, lazy load, alt descritivo, link externo `target=_blank` + rel.
- [ ] FAQSection: ≥ 8 perguntas (cobertura #G3); schema FAQPage injetado (#S5).
- [ ] ContactBanner: 1 CTA WhatsApp primary, telefone secondary; tracking `data-evt`.
- [ ] ContactFormQuick: react-hook-form + zod, validação inline, success state com confetti gentil (`prefers-reduced-motion` honra).
- [ ] Tracking de submit registra em `lead_messages` (já existe? verificar pipeline).
- [ ] A11y: form labels associados, error messages role=alert.

---

### Rota `/sobre`

#### #P5 — Premium Pass: `/sobre`

**Componentes tocados:** `AboutHeroEditorial`, novo `AboutTimeline`, novo `AboutTeam`.

**AC:**
- [ ] Hero editorial com manifest IA (#217 já cobre).
- [ ] Nova seção `AboutTimeline`: marcos do negócio (fundação, expansão, prêmios) — auto-gerado IA quando lead tem dados; opt-in admin.
- [ ] Nova seção `AboutTeam`: opcional, lead adiciona via admin (V2 — só mockup neste #P5).
- [ ] Conteúdo ≥ 300 palavras únicas por site (E-E-A-T via `seo-content`).
- [ ] Schema `AboutPage` injetado.
- [ ] Microcopy patterns de #G6.

---

### Rota `/contato`

#### #P6 — Premium Pass: `/contato`

**Componentes tocados:** `ContactSection`, mapa estático (#230).

**AC:**
- [ ] ContactSection: dois pares (form + info de contato lado a lado em desktop; stacked mobile).
- [ ] Mapa: Google Static Maps API (#230 já existe); fallback link externo se key ausente.
- [ ] Horários de atendimento em `<table>` semântica + schema `openingHoursSpecification`.
- [ ] CTA WhatsApp grande no topo + form abaixo.
- [ ] Schema `ContactPage` + `Place` injetado.
- [ ] Validação form: react-hook-form + zod.
- [ ] Tracking `data-evt` em todos os links de contato.

---

### Rota `/anunciar`

#### #P7 — Premium Pass: `/anunciar`

**Componentes tocados:** `SiteForm` (variant anunciar), upload de fotos.

**AC:**
- [ ] Form orientado pra captação de seminovo: dados do carro + dados do proprietário + 4-6 fotos (upload com preview).
- [ ] HMAC signing (#231 já existe) protege contra spam.
- [ ] Microcopy: explicação clara do processo ("3 passos: cadastra → avaliamos → fazemos proposta em 24h").
- [ ] Confirmation page após submit com timeline esperada + link WhatsApp.
- [ ] A11y: file upload com label visível + drop zone keyboard-accessible.

---

### Rota `/estoque`

#### #P8 — Premium Pass: `/estoque` — Listagem

**Componentes tocados:** novo `EstoqueGrid`, `EstoqueFilters`, `EstoquePagination`.

**AC:**
- [ ] Grid responsiva (1/2/3/4 cols por viewport).
- [ ] Filtros: marca, faixa de preço, ano, km, combustível, câmbio. Persistem em URL (`?marca=BMW&precoMax=200000`).
- [ ] Server Component renderiza listagem (SSR cacheable); filters são RSC params, sem client-side filter (V1).
- [ ] Pagination: 12 cars/page, `rel="next"`/`rel="prev"` pra SEO.
- [ ] Empty state desenhado.
- [ ] Loading skeleton durante navigation.
- [ ] Schema `ItemList` (lista de Vehicle).
- [ ] Each card linka pra `/estoque/<carSlug>`.

---

### Rota `/estoque/[carSlug]`

#### #P9 — Premium Pass: `/estoque/[car]` — Detalhe do carro

**Componentes tocados:** novo `CarDetailHero`, `CarDetailGallery`, `CarDetailSpecs`, `CarDetailFinancing`, `CarDetailCTA`, `CarDetailRelatedCars` (#S8).

**AC:**
- [ ] Hero com 1 foto large + gallery thumbnails (clica abre lightbox).
- [ ] Specs em grid: ano, km, motor, câmbio, combustível, cor, IPVA, placa final.
- [ ] Pricing destacado + faixa de financiamento (calculator inline ou widget).
- [ ] CTAs: WhatsApp pré-preenchido (`"Olá, quero saber mais do <modelo> <ano>"`), agendar visita, simular financiamento.
- [ ] FloatingInstallmentBar sticky em mobile.
- [ ] Schema Vehicle (#S4) + breadcrumb (#S5).
- [ ] Related cars (#S8) no fim.
- [ ] OG image dinâmica com foto do carro + preço.
- [ ] Lighthouse mobile ≥ 90.

---

### Rota `/lgpd`

#### #P10 — Premium Pass: `/lgpd`

**AC:**
- [ ] Conteúdo legal padronizado mas com nome do negócio + DPO contact injetado dinamicamente.
- [ ] Headings semânticos (`<h2>` por seção).
- [ ] Schema `WebPage` + `PrivacyPolicy` (extensão schema.org).
- [ ] Link footer presente em todas as rotas.
- [ ] A11y: estrutura `<article>` + landmarks ARIA.

---

### Polish cross-rota

#### #P11 — `<SiteHeader>` + `<SiteFooter>` premium pass

**AC:**
- [ ] Header: nav distinta por tema (#02); mobile menu com transição suave; logo com `onError` fallback (já existe per #218 — auditar).
- [ ] Footer: 4 colunas em desktop (links / contato / horários / social), stacked mobile.
- [ ] WhatsApp floating CTA aparece após scroll > 30% e some quando form é focado.
- [ ] CookieBanner LGPD revisado: copy curto, 1 CTA primary "Aceitar essenciais", secondary "Configurar", terceiro "Aceitar todos".
- [ ] AnnouncementBar (quando habilitada) com close + persistência localStorage.

---

#### #P12 — Motion choreography global

**AC:**
- [ ] `lib/sites/motion.ts` exporta `motionTokens` por tema (já em #V1 tokens).
- [ ] Stagger reveal em scroll (`data-reveal`) consistente.
- [ ] `prefers-reduced-motion` desabilita TODA animação.
- [ ] Sem layout shift em mount.
- [ ] Lighthouse INP ≤ 200ms global.
- [ ] Documentado em `components/sites/CLAUDE.md`.

---

#### #P13 — Final audit + checklist de release

**AC:**
- [ ] Para cada rota: print before/after (3 temas × 7 rotas = 21 prints).
- [ ] Lighthouse mobile rodado em ≥ 3 sites publicados; relatório anexado.
- [ ] `seo-audit` full rodado; output em `docs/audits/2026-XX-premium-pass-final.md`.
- [ ] `seo-content` E-E-A-T score ≥ 80 em ≥ 3 sites.
- [ ] `seo-geo` AI citability ≥ 80 em ≥ 3 sites.
- [ ] `sentry-skills:code-review` + `security-review` em todo PR fechado.
- [ ] North-star spec atualizada com "shipped" timestamp.

---

## 4. Estratégia de execução

1. **Ordem:** P1-P4 (Home — alto impacto), depois P5-P9 (sub-rotas), depois P10-P13 (polish + audit).
2. **1 issue = 1 PR.** PRs entre 500-1500 LoC; se exceder, dev decompõe.
3. **Cada PR atravessa quality gates** (§2.2 do north-star).
4. **Visual regression** (#V11 do spec 02) é gate adicional: PR não merga se snapshot diff > 0.1% em rota não-tocada.
5. **Flag de rollout:** mudanças visuais grandes opcionalmente atrás de `NEXT_PUBLIC_SITES_PREMIUM_V2`; default `1` em preview, `0` em prod até PO aprovar (decisão por PR).

---

## 5. Critérios de saída

- [ ] 13 issues fechadas.
- [ ] 21 screenshots before/after publicados.
- [ ] Lighthouse mobile ≥ 90 perf, ≥ 95 SEO/a11y em todas as 7 rotas, todos os 3 temas.
- [ ] `seo-audit` health score ≥ 90 em ≥ 3 sites piloto.
- [ ] Blind test "este site é genérico ou premium?" — ≥ 80% respondem "premium".
- [ ] Métrica conversão (WhatsApp + form) sobe ≥ 50% em 30 dias pós-rollout.

---

## 6. Riscos & mitigações

| Risco | Mitigação |
|---|---|
| Refator quebra layout em algum tema | Visual regression do #V11 + revisar print antes do merge |
| Conversion metrics são lagging — descobrimos regressão tarde demais | Manter `data-evt` analytics + dashboard interno (V2 epic) |
| Microcopy IA-gerado fica robótico | Patterns de #G6 + revisão humana spot-check em 5 sites/mês |
| Lighthouse mobile cai com adição de gallery + lightbox | `vercel:performance-optimizer` audita antes do merge |
| Conflito com PRs em vôo doutros agents | Branch hygiene + small PRs + `git rebase main` antes do PR |
| Lead piloto resiste à mudança | Rollout opt-in via flag; comunicar antes; manter rollback via `theme_id` revert |

---

## 7. Fora de escopo (V2+)

- Editor visual (lead muda hero text sem admin GaspLab) — V2.
- A/B testing automatizado (Posthog/Vercel Edge Config) — V2.
- Pages adicionais (`/historico`, `/eventos`, `/blog`) — V2.
- White-label per lead (CSS custom além do tema) — V2.
- Internal admin dashboard de SEO/conversion health — V2.
