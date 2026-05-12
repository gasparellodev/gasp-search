# `components/sites/` — Componentes públicos do Site Generator (Phase 7)

## Propósito

Componentes React renderizados nos sites públicos das concessionárias
(`/sites/<slug>/...`). Diferente do app interno (`(app)/...`), estes
componentes:

- **Não dependem de Supabase Auth** — quem acessa o site público é o
  usuário final, não o lead/dono GaspLab.
- **Recebem `variables`** validados via `SiteVariables` (Zod) — fonte
  única de verdade do conteúdo do site.
- **Usam CSS vars** `--site-primary` / `--site-text-on-primary`
  injetadas pelo wrapper `<SitePage>` (issue #160). Componentes podem
  receber `primary_color` / `text_on_primary` direto via prop como
  fallback (sanitizados via `sanitizeHex`).

## Manifest de identidade visual (Sprint 2 / #A3 — #217)

A Server Action `regenerateVisualIdentity` (#216) persiste um
`VisualIdentityManifest` (9 URLs AI) em `lead_sites.visual_identity`.
Os 3 Server Components consumem manifest **upstream via prop**, com
fallback gracioso ao `brand_assets`:

```ts
// Pattern unificado (página upstream resolve, componente fica thin):
const heroUrl   = manifest?.hero_url    ?? variables.brand_assets.hero_image_url;
const aboutUrl  = manifest?.about_url   ?? variables.brand_assets.about_image_url;
const contactUrl = manifest?.contact_url ?? variables.brand_assets.contact_image_url;
```

- **`<HomeHero hero_image_url>`** — `<SitePage manifest>` resolve.
- **`<AboutSection manifestAboutUrl>`** — `/sobre/page.tsx` resolve.
- **`<ContactSection manifestContactUrl>`** — `/contato/page.tsx` resolve.
- **`opengraph-image.tsx`** — mesmo pattern para hero (manifest precedence).

Sprint 4 (#H1/#H2/#H3) vai adicionar `<HomeWarrantySection>` /
`<HomeTradeinWidget>` / `<HomeCategoriesCars>` que consomem
`manifest.categories_urls[]`; **NÃO existe ainda** e fica fora do scope
de #217. Componentes que ainda não foram criados não recebem override.

## Como adicionar

- 1 arquivo por componente, em PascalCase (ex: `SiteHeader.tsx`).
- **Server Component por padrão.** Só extrair pra Client Component
  quando precisar de estado/handlers (caso de `MobileNav.tsx` —
  sub-component do header).
- Componentes que recebem `variables: SiteVariables` devem aceitar
  apenas o subset que consomem (`Pick<SiteVariables, ...>`). Isso
  evita acoplar componentes a campos que não usam — facilita reuso e
  testes.
- **Cores via CSS vars + `style` inline.** Tailwind v4 não trata
  `bg-[var(--site-primary)]` perfeitamente em todos os edges; usar
  `style={{ backgroundColor: sanitizeHex(...) }}` para componentes
  ativos é mais robusto e permite teste via `toHaveStyle`.
- Toda escrita de cor para `style` inline DEVE passar por
  `sanitizeHex()` de `@/lib/sites/sanitize` — defesa em profundidade
  contra CSS injection.

## Tema visual padrão (decisão 2026-05-09)

Site público é **uniformemente** branco/preto/vermelho:

- **Fundo**: `bg-background` (branco em light mode, default).
- **Texto**: `text-foreground` (preto em light mode, default).
- **Botões / badges / chips ativos**: `primary_color` do lead (vermelho
  pra Poliguara) via `style={{ backgroundColor: sanitizeHex(...) }}` ou
  CSS var `var(--site-primary)` (injetada pelo `<SitePage>` wrapper).
  Texto sobre botão: `text_on_primary` (`#FFFFFF` ou `#0C0C0C`,
  calculado pelo brand-pipeline pra contraste WCAG).

**NUNCA** usar `bg-foreground text-background` (cria botão preto fixo
em light mode, conflita com tema).

### Exceções intencionais (NÃO mudar)

1. **Gradient overlay nos cards de imagem** (`HomeCategories`,
   `HomeRecentSales`): `bg-gradient-to-t from-black/60` + `text-white`
   sobre a foto. **Não é tema dark** — é contraste pra leitura do
   texto sobre imagem (categoria, car_name). Padrão universal premium.

2. **Lightbox `<dialog>` da `CarGallery`**: `bg-black/95` + `text-white`.
   Convenção universal de image viewer (preserva contraste das fotos do
   carro). Não é "fundo do site" — é overlay transient.

3. **`<HomeContactFormQuick>` dark card** (#223 — Sprint 4 / H3):
   `bg-foreground text-background`. Lead capture principal da Home é
   intencionalmente um dark card destacado pra criar âncora visual e
   sinalizar conversão final. Aprovado por PO no refinement de #223.
   Não replicar em outros forms (`<SiteForm variant>` mantém bg light).

## Regras de negócio

1. **Logo do header é `<img>` plain (#218).** É asset pequeno e já
   sanitizado/pre-signed no pipeline; `SiteHeader` precisa de `onError`
   client-side para fallback textual. Imagens de seção/card continuam
   usando `next/image` com `unoptimized` quando vêm de CDN externo.
2. **Links internos via `next/link`.** `<a>` cru só pra externos
   (sociais, WhatsApp, mailto).
3. **Links externos** sempre com `target="_blank"` e
   `rel="noopener noreferrer"` (a11y + segurança contra reverse
   tabnabbing).
4. **Footer não captura newsletter.** A issue #219 substituiu a coluna
   de newsletter visual-only por navegação + LGPD, NAP completo, banks
   strip e payment methods. Não adicionar form de captura no footer sem
   issue dedicada.
5. **`SiteForm` chama Server Action** `submitSiteForm` em
   `app/actions/site-form.ts`. MVP retorna `{ success: true }`;
   persistência em `site_form_submissions` é follow-up.
6. **Acessibilidade obrigatória.** `aria-current="page"` em links de
   nav ativos; `aria-expanded`/`aria-controls` em hambúrguer; foco
   volta ao botão hambúrguer ao fechar menu; `role="alert"` em
   mensagens de erro de form; `aria-describedby` ligando inputs aos
   alerts.
7. **PT-BR** em todos os textos visíveis ao usuário final.

## Arquivos

| Path | Propósito |
|---|---|
| `SitePage.tsx` | **Server Component (M2.1 stub → M2.3 → M2.4 → G1/G3 → Sprint 4 / #H1 — issues #160 + #162 + #163 + #217 + #218 + #220 + #221).** Wrapper público de `/sites/[slug]` e sub-rotas. Recebe `{ variables, siteId, slug, activePage?, children?, manifest?, mainClassName?, rating?, reviewsCount? }`. Injeta CSS vars `--site-primary` / `--site-text-on-primary` (sanitizadas via `sanitizeHex`) + `data-site-id` para E2E. Sem `children`: compõe `<SiteHeader>` + 6 seções da Home V2 (`HomeHero`, `HomeTrustStrip`, `HomeCategoriesCars`, `HomeForm`, `HomeEmphasis`, `HomeRecentSales`) + `<SiteFooter>`. **#221 (Sprint 4 / #H1):** `HomeCategories` (3 cards) substituído por `HomeCategoriesCars` (6 cards visuais com fotos AI por categoria); `HomeTrustStrip` adicionado entre Hero e CategoriesCars; props `rating`/`reviewsCount` propagados ao `<HomeTrustStrip>` (caller `app/sites/[slug]/page.tsx` lê de `site.lead_rating`/`site.lead_reviews_count` via join em `getSite()`); `manifest.categories_urls` propagado ao `<HomeCategoriesCars manifestCategoriesUrls>`. Com `children`: renderiza-os entre Header e Footer (M2.4 — `/sobre`, `/contato`, `/anunciar`). **#218:** injeta `<div data-site-header-sentinel>` no topo do `<main>` para o glass-sticky header observar scroll sem listeners agressivos. **#220:** `mainClassName` permite reservar padding mobile no detail quando a barra fixed está ativa. **#217 (Sprint 2 / #A3):** `manifest?: VisualIdentityManifest \| null` (vindo de `site.visual_identity` parseado em `getSite()`) resolve `heroImageUrl = manifest?.hero_url ?? brand_assets.hero_image_url` e propaga pra `<HomeHero hero_image_url>`. Sub-rotas (sobre/contato) NÃO recebem o override pelo SitePage — elas passam o override diretamente pro `<AboutSection manifestAboutUrl>` / `<ContactSection manifestContactUrl>` (mesmo manifest, fields diferentes). |
| `SiteHeader.tsx` | **Client Component (#218 / Sprint 3 G1).** Header glass-sticky 64px mobile / 80px desktop. Usa `usePathname()` para `aria-current`, `IntersectionObserver` no sentinel do `<SitePage>` para `data-scrolled`, fallback scroll passive/RAF, logo com `<img>` plain + fallback textual em erro, 5 links internos (`Home`, `Estoque`, `Sobre`, `Contato`, `Anunciar`) e CTA WhatsApp via `buildWhatsAppLink({ template: 'general', component: 'header' })`. Consome tokens `var(--auto-*)` e cor ativa via `sanitizeHex(brand_assets.*)`. |
| `Breadcrumb.tsx` | **Server Component (#232).** Breadcrumb visual compartilhado para rotas públicas de site. Recebe `items: {label, href?}[]`, renderiza `<nav aria-label="Breadcrumb">`, links intermediários via `next/link` e item atual com `aria-current="page"`. |
| `SiteFAQ.tsx` | **Client Component (#232).** Accordion FAQ compartilhado com Radix. Recebe `title`, `items`, `eyebrow?`, `testId?`. Não emite JSON-LD `FAQPage`; é UX visível apenas. `HomeFAQSection` usa este componente com `FAQ_TEMPLATE`. |
| `MobileNav.tsx` | **Client Component.** Radix Dialog fullscreen mobile com focus trap, ESC, body scroll lock, close button, fechamento ao clicar na área vazia, links que fecham o menu e popstate/back-button que fecha o menu. Recebe links e WhatsApp href do `<SiteHeader>`. |
| `SiteFooter.tsx` | **Server Component (#219 / Sprint 3 G2).** Footer global 4-colunas desktop / stack mobile: marca + sameAs icons, NAP completo em `<address>`, horários (`variables.hours ?? "Segunda a Sexta: 09h-18h \| Sábado: 09h-13h"`), navegação + link interno `/sites/<slug>/lgpd` (#234), banks strip, payment methods e microbranding "Site por GaspLab". Consome `SiteVariablesV2` (`brand_assets`, `address`, `hours`) e mantém fallback gracioso quando `address`/`email` são `null`. |
| `CookieBanner.tsx` | **Client Component (#234).** Banner LGPD global dos sites públicos. Opt-in default via `localStorage` key `gasp_consent_v1`; categorias `necessary` (sempre on), `analytics`, `marketing`; botão "Aceitar todos", modal Radix "Personalizar" com focus trap/ESC, e "Apenas necessários". Persiste auditoria best-effort via `recordConsentDecision`. |
| `BanksStrip.tsx` | **Server Component (#219).** Strip compartilhada de 7 bancos parceiros com SVGs locais em `public/assets/banks/*`. Ícones têm dimensões fixas 40×40 para evitar CLS e `alt` como fallback de asset. |
| `PaymentStrip.tsx` | **Server Component (#219).** Strip compartilhada de 6 métodos de pagamento com SVGs locais em `public/assets/payment/*`. Ícones têm dimensões fixas 40×40 para evitar CLS e `alt` como fallback de asset. |
| `WhatsAppFloatingCTA.tsx` | **Client Component (#220 / Sprint 3 G3).** CTA global fixo bottom-right para todas as rotas `/sites/<slug>/*`. Usa `buildWhatsAppLink({ template: 'general', component: 'floating-cta' })`, `WhatsappIcon`, `aria-label="Contato WhatsApp"`, `title` desktop, `--z-floating-cta: 50`, `--auto-shadow-whatsapp-floating`, safe-area inset e `useFloatingCtaVisibility()` para desmontar quando `body[data-modal-open]` estiver presente. |
| `FloatingInstallmentBar.tsx` | **Client Component (#220 / Sprint 3 G3).** Barra fixed bottom mobile-only no detalhe do carro. Desmonta em desktop via `useSyncExternalStore` + media query `(min-width: 1024px)` (não apenas `lg:hidden`). Consome `useCarContext(slug, carSlug, initialContext)` para labels de preço/parcela e link `vehicle` com contexto do carro. Z-index `--z-installment-bar: 45`, abaixo de modal/drawer. |
| `SiteForm.tsx` | **Client Component.** Form de captura com 3 variantes (`'home'`/`'contact'`/`'car-detail'`). `react-hook-form` + `zodResolver`. `model` read-only quando `variant='car-detail'` com `prefillModel`. LGPD checkbox obrigatório. Aceita `title?: string` para override do `<h2>` default (usado por `<HomeForm>` em #162). |
| `social-icons.tsx` | SVGs inline de Instagram/Facebook/YouTube/WhatsApp — `lucide-react@^1.14` removeu os ícones de marca por trademark. Pure server-renderable. |
| `AICitableHero.tsx` | **Server Component (#214 / Sprint 1 / #S4 — fecha ciclo GEO).** Renderiza `<p data-testid="ai-citable-hero">` factual passage-citable para AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Gemini). Props: `{ variables: Pick<SiteVariablesV2, 'business_name'\|'address'\|'cars'>, page: 'home'\|'estoque'\|'detalhe', currentCar?: {brand,model,year} }`. **Decisões PO (#214):** (1) Frase factual SEM "loja online" — usa "loja de carros seminovos" para evitar AI gerar expectativa de e-commerce. (2) Hedging "consulte estoque atualizado" NÃO entra na frase principal — fica só no rodapé do `llms.txt`. (3) **SEMPRE visível mobile** — proibido `sr-only` porque AI crawlers são mobile-first; tipografia `text-muted-foreground text-sm` mantém discreto sem esconder. (4) Frase contextualizada por rota: `home` ("X é loja de carros seminovos em Y/Z, com N carros em estoque a partir de R$ ..."), `estoque` ("Estoque atualizado de X em Y/Z — N carros seminovos disponíveis a partir de R$ ..."), `detalhe` ("Brand Model Year disponível em X, Y/Z. Veja mais carros seminovos em nosso estoque."). (5) Address null → fallback "no Brasil" (home) / omite locale suffix (estoque/detalhe). (6) `cars.length === 0` → omite cláusula numérica gracefully. (7) Min price calculado de `cars[].price` (filtra null e <=0) via `Math.min`. **Wired em**: `home/HomeHero.tsx` (após `<h1>` slogan — propaga via `address`/`cars` props adicionados ao caller `SitePage`), `stock/StockSection.tsx` (após `<h1>` "Estoque" — usa o `variables` que já recebe), `stock/CarDetailSection.tsx` (após `<h1>` model/year — `currentCar` derivado do car renderizado; `Pick` extendido com `address`+`cars`). |
| `site-nav-links.ts` | Pure data (`buildSiteNavLinks(slug)` + tipos). Compartilhado entre `SiteHeader` (server) e `MobileNav` (client). |
| `home/` | Sub-componentes Server-only que compõem a Home (`HomeHero`, `HomeCategories`, `HomeForm`, `HomeEmphasis`, `HomeRecentSales` — issue #162). Ver `home/CLAUDE.md`. |
| `about/` | Section da rota `/sobre` (`AboutSection` — issue #163). Server-only. Ver `about/CLAUDE.md`. |
| `contact/` | Section da rota `/contato` (`ContactSection` — issue #163). Server-only com `<SiteForm variant="contact">` aninhado. Ver `contact/CLAUDE.md`. |
| `advertise/` | Section da rota `/anunciar` (`AdvertiseSection` server + `AnnounceForm` client — issue #163). Form de captura de anúncio com schema Zod compartilhado em `lib/sites/announcement.schema.ts`. Ver `advertise/CLAUDE.md`. |
| `stock/` | Sections de `/estoque` (lista com filtros #224 + sort/paginação #225) e `/estoque/[carSlug]` (detalhe-do-carro com `<dialog>` lightbox nativo). `<StockSection>` server injeta `<StockClientView>` client; o client aplica filtros, `sortCars`, `paginate`, sidebar/drawer, empty state, Radix sort dropdown e paginação. `<StockGrid>` reutiliza `<CarCard>` compartilhado. Helper puro `car-categories.ts` mantém compat `?categoria=` legado. `<CarDetailSection>` reusa `<SiteForm variant="car-detail" prefillModel>`. Ver `stock/CLAUDE.md`. |
| `cars/` | **Shared building blocks** de veículos reusados entre páginas (vs `stock/` que é page-level) — issue #201. `<CarCard>` é shared client/server-safe desde #225 e implementa a anatomia §card-vehicle do DESIGN.md (foto 4:3, eyebrow brand mono uppercase, h3 model+year display, km·fuel·transmission inline, price BRL, installment "Ou 48x de R$ X", botão WhatsApp inline). Consome tokens `var(--auto-*)` (não classes Tailwind genéricas). WhatsApp link extraído do `<Link>` interno (evita nested anchor). Foto via `car.thumbnail_url` canon (v1+v2, não `photos[0]`). Reusado em H2/E2/D2/D3 das Sprints 4-6. Ver `cars/CLAUDE.md`. |

## Boundary client/server

```
┌─ SiteHeader (client) ────────────────┐
│  glass state + pathname active nav   │
│  ┌─ MobileNav (client) ─────────┐    │
│  │  Radix fullscreen menu       │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘

┌─ SiteFooter (server) ──── pure server ┐
└───────────────────────────────────────┘

┌─ WhatsAppFloatingCTA (client) ────────┐
│  body[data-modal-open] visibility     │
└───────────────────────────────────────┘

┌─ FloatingInstallmentBar (client) ─────┐
│  matchMedia desktop unmount + wa link │
└───────────────────────────────────────┘

┌─ SiteForm (client, full) ─────────────┐
│  react-hook-form + Server Action call │
└───────────────────────────────────────┘
```

`SiteForm` é client por inteiro (precisa do `useForm` hook). Em troca,
a Server Action `submitSiteForm` é chamada por referência — a borda
client/server fica explícita no import de `@/app/actions/site-form`.

## Dependências

- `react-hook-form@^7` + `@hookform/resolvers@^5` (form state e Zod adapter).
- `zod@^4` (schema do form em `lib/sites/site-form.schema.ts`).
- `sonner@^2` (toast de feedback do submit).
- `lucide-react@^1.14` (ícones genéricos: `Menu`, `X`,
  `MessageCircle`, `ArrowRight`, `Loader2`). Brand icons em
  `social-icons.tsx`.
- `next/link`, `next/image`.
- `radix-ui` Dialog primitive — focus trap/body scroll lock do
  `<MobileNav>`.
- `@/lib/whatsapp` — CTA header/mobile com template `general`.
- `@/lib/hooks/use-floating-cta-visibility` — esconde CTA global quando modal/drawer sinaliza `body[data-modal-open]`.
- `@/lib/hooks/use-car-context` — normaliza contexto serializado do carro para a barra mobile.
- `@/lib/hooks/use-consent` — lê consentimento granular do banner LGPD.
- `@/lib/sites/sanitize` — defesa em profundidade pra cores hex.
- `radix-ui` Accordion primitive — usado pelo `<SiteFAQ>`.

## Quando atualizar este `CLAUDE.md`

- Novo Site Component (`SiteHero`, `SiteCard`, etc.) na pasta.
- Mudança no contrato de props de algum componente já existente.
- Mudança na fronteira client/server (ex: extrair novo client sub-component).
