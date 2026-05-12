# `components/sites/stock/` — Estoque + Detalhe-do-carro (Phase 7 #164)

## Propósito

Componentes que renderizam:

- **Lista de estoque** (`/sites/<slug>/estoque`) — `<StockSection>` orquestra
  `<StockHeroMini>` (server) + `<StockClientView>` (client). O client view
  mantém filtro em memória, sincroniza URL com debounce 300ms, aplica
  `sortCars` + `paginate`, renderiza `<StockSearchBar>`,
  `<StockFilterSidebar>` desktop, `<StockFilterDrawer>` mobile (Vaul),
  `<StockGrid>` com `<CarCard>` compartilhado, empty state e paginação.
- **Detalhe do carro** (`/sites/<slug>/estoque/<carSlug>`) —
  `<CarDetailSection>` com `<CarGallery>` (lightbox `<dialog>` nativo),
  badges, datasheet `<dl>`, descrição com `whitespace-pre-line` e
  `<SiteForm variant="car-detail">` aninhado.

Reutiliza `<SitePage>` parent (CSS vars já injetadas) e `<SiteForm>`
existente (variant `'car-detail'`).

## Boundary client/server

```
┌─ StockSection (server) ────────────────────┐
│  StockHeroMini + StockClientView(key=qs)   │
│  ┌─ StockClientView (client) ────┐         │
│  │  filter + sort + paginate     │         │
│  │  router.replace debounce 300ms│         │
│  │  Sidebar desktop / Drawer mob │         │
│  └───────────────────────────────┘         │
│  ┌─ StockGrid (shared) ──────────┐         │
│  │  render N shared <CarCard>    │         │
│  └───────────────────────────────┘         │
└────────────────────────────────────────────┘

┌─ CarDetailSection (server, D1 #226) ───────┐
│  DetailBreadcrumb + WhatsApp CTA           │
│  ┌─ DetailGalleryCinema (client) ─┐        │
│  │  scroll-snap + Radix lightbox  │        │
│  └────────────────────────────────┘        │
│  DetailInfoBlock + DetailSpecGrid          │
│  <SiteForm/>                               │
└────────────────────────────────────────────┘
```

## Como adicionar / modificar

- 1 arquivo por componente. PascalCase.
- **Server por padrão**; `'use client'` só em componentes com estado/handlers
  (`StockClientView`, `StockSearchBar`, `StockFilterSidebar`,
  `StockFilterDrawer`, `StockFilterControls`) e `CarGallery` (`useRef` para `<dialog>`,
  `useState` para `activeIdx`/`open`).
- **Sempre `import 'server-only'`** em arquivos server-only.
- **Acesso a `cars[]`**: tipos via `Pick<SiteVariables, ...>` quando o
  componente só consome um subset (CarDetailSection usa `business_name`,
  `whatsapp`, `phone_display`, `primary_color`, `text_on_primary` —
  o `car` em si é separado).
- **Sem dangerouslySetInnerHTML**. `car.description` em `<p
  whitespace-pre-line>` (preserva quebras `\n`).
- **Detail D1 (#226)** usa scroll-snap CSS + JS mínimo para galeria
  cinema e Radix Dialog para lightbox (focus trap/body scroll lock/ESC).
  Não adicionar Embla ou biblioteca de lightbox externa no D1.
- **URLs externas**: sempre `target="_blank" rel="noopener noreferrer"`.

## Regras de negócio específicas

1. **Filtros #224 via short keys**: contrato canônico em
   `lib/sites/stock-search-params.ts`. Keys: `q`, `m`, `model`, `c`,
   `pmin/pmax`, `imin/imax`, `ymin/ymax`, `kmmin/kmmax`, `tr`, `fl`, `cor`.
   `parseStockFilters` preserva passthrough desconhecido (`sort`, `page`) e
   aceita legado `categoria`/`picape`; `serializeStockFilters` emite `c=pickup`.
2. **Classificação heurística** via `classifyCar(car)` (`car-categories.ts`):
   match por keyword em `brand+model` normalizado (NFKD lowercase). Ordem
   importa — `picape > esportivo > suv > sedan > hatch`. Carros que não
   batem retornam `null` e ficam **fora** quando há filtro ativo.
3. **Sort #225**: `StockClientView` aplica filtros em memória e ordena via
   `lib/stock/sort.ts`. Opções públicas: `most_recent` (destaque primeiro,
   depois ano), `price_asc`, `price_desc`, `installment_asc`, `km_asc`.
   `sort=most_recent` é default e pode ser omitido da URL.
4. **Paginação #225**: `page` vem de `filters.passthrough.page` e passa por
   `parseStockPage`; o slice usa `paginate(items, page, STOCK_PAGE_SIZE)` com
   `STOCK_PAGE_SIZE=12`. Desktop mostra botões numerados prev/next; mobile
   mostra CTA "Carregar mais 12" para avançar página.
5. **Empty state**: 0 matches → SVG ilustrativo + mensagem PT-BR + Link
   "Limpar filtros" para `/sites/<slug>/estoque` (sem querystring).
5. **BRL price**: `Intl.NumberFormat('pt-BR', { style: 'currency',
   currency: 'BRL', maximumFractionDigits: 0 })`. Quando `price === null`
   → "Sob consulta".
6. **WhatsApp CTA** em `<CarDetailSection>`: `https://wa.me/<digits>?text=
   <encoded>` com `aria-label` descritivo. Mensagem template "Olá, tenho
   interesse no <brand> <model> <year>".
7. **Lightbox D1 (#226)**: Radix Dialog, `ArrowLeft/ArrowRight`,
   `Home/End`, ESC nativo do Radix e retorno de foco ao trigger. Layer
   `--z-lightbox: 90`, acima de cookie banner/floating UI.
8. **`<SiteForm variant="car-detail" prefillModel="<brand> <model>">`**
   inline no fim do detalhe. Reusa o componente já existente em
   `components/sites/SiteForm.tsx` — campo `model` fica read-only.
9. **Spec grid D1 (#226)**: composição híbrida. Renderiza top-level
   (`brand`, `model`, `year`, `km`, `fuel`, `transmission`, `color`),
   `doors`/`category` quando presentes e apenas datasheet com labels
   case-insensitive `motor`, `cilindradas`, `final.*placa`. Omitir
   ausentes; não emitir placeholder `—`.

## Arquivos

| Path | Propósito |
|---|---|
| `StockSection.tsx` | Server. Renderiza `<StockHeroMini>` + `<StockClientView>`, passando `initialFilters` parseado pela rota. Mantém compat legado `categoriaFilter` para testes/links antigos. |
| `StockHeroMini.tsx` | Server. Mini hero 30dvh com `<h1>Nosso Estoque</h1>`, contagem `${cars.length} carros disponíveis` e `<AICitableHero page="estoque">` imediatamente após o h1. |
| `StockClientView.tsx` | **Client.** Orquestra estado de filtros, URL sync com `router.replace` debounced 300ms, `applyStockFilters` + `sortCars` + `paginate`, empty state, sidebar desktop, drawer mobile e paginação. Remonta por `key=serializeStockFilters(filters)` no server para browser back refletir URL sem `setState` em effect. |
| `StockSearchBar.tsx` | **Client.** Barra sticky `top-[var(--site-header-h)]` com search input, `<StockSortDropdown>` Radix e botão mobile de filtros com badge. Layer `--z-stock-search: 40`. |
| `StockSortDropdown.tsx` | **Client.** Radix `<Select>` com as 5 opções públicas de sort vindas de `STOCK_SORT_OPTIONS`. |
| `StockFilterSidebar.tsx` | **Client.** Sidebar desktop col 3/12 com 10 accordion sections; Marca/Modelo abertas por default. |
| `StockFilterDrawer.tsx` | **Client.** Vaul bottom sheet mobile, `max-h-[90dvh]`, layer `--z-stock-drawer: 60`, título Dialog e botão fechar. |
| `StockFilterControls.tsx` | **Client.** Renderer compartilhado das 10 sections (checkboxes + inputs number HTML5 para ranges). |
| `StockFilter.tsx` | **Legacy client (#164).** Chip multi-select de `?categoria=` mantido temporariamente para compat, mas a rota #224 usa Sidebar/Drawer. |
| `StockGrid.tsx` | Shared Client/Server-safe. Grid 1/2/3 cols que reutiliza `<CarCard>` para cada veículo, preservando `data-testid="car-card-<slug>"`, raio 8px e WhatsApp inline. |
| `StockPagination.tsx` | **Client.** Navegação de páginas do estoque: prev/next + números no desktop, botão "Carregar mais 12" no mobile. |
| `StockEmptyState.tsx` | **Client.** Empty state desenhado com SVG, copy PT-BR e CTA "Limpar filtros". |
| `CarDetailSection.tsx` | Server. Orquestra D1/D2 (#226/#227): `<DetailBreadcrumb>`, `<DetailGalleryCinema>`, `<DetailInfoBlock>`, `<DetailPriceBlock>` (preço sticky, calculadora, CTAs), `<DetailSpecGrid>` e `<SiteForm variant="car-detail">`. **#220:** a barra mobile fixed vive fora deste section, no caller da rota. |
| `CarGallery.tsx` | **Client.** Imagem principal + thumbs + `<dialog>` lightbox. `dialogRef` + ESC + restauração de foco. |
| `DetailBreadcrumb.tsx` | Server. Compõe `<Breadcrumb>` shared visual: Estoque → Marca filtrada (`?m=`) → Modelo Ano. BreadcrumbList JSON-LD segue no `SiteSchema` parent da rota. |
| `DetailGalleryCinema.tsx` | **Client.** Galeria cinema full-height (`70dvh`) com scroll-snap horizontal, `<Image priority>` na primeira foto, `sizes="(max-width: 768px) 100vw, 70vw"`, alt `${brand} ${model} ${year} - foto ${index+1}`, contador `aria-live` e lightbox Radix com teclado. |
| `DetailInfoBlock.tsx` | Server. Renderiza H1 model/year, `<AICitableHero page="detalhe">` imediatamente após o H1, badges e descrição com `whitespace-pre-line` sem HTML. O preço fica no `<DetailPriceBlock>` colateral (#227). |
| `DetailPriceBlock.tsx` | Server. Coluna lateral: preço BRL ou “Preço sob consulta”, parcela default, `<DetailFinancingCalcInline>` (client), selos de confiança, `<DetailCtaStack>`. Sticky `lg:top-24`. Estados `available: false` / `status: "sold"` → VENDIDO + CTAs desabilitados. |
| `DetailFinancingCalcInline.tsx` | **Client.** Calculadora Tabela PRICE + disclaimer + CTA WhatsApp `financing` (`utm_content=detail-financing-inline`). |
| `DetailCtaStack.tsx` | Shared. Dois CTAs full-width template `vehicle` com `utm_content` distinto (`detail-cta-primary` / `detail-cta-secondary`); prop `unavailable` desabilita ambos. |
| `DetailSpecGrid.tsx` | Server. Grid híbrido top-level + datasheet allowlist para ficha técnica D1. |
| `car-categories.ts` | Pure helpers — `classifyCar(car)`, `parseCategoriaParam(raw)`, type `CarCategorySlug`. |

## Testes

| Path | Cobertura |
|---|---|
| `tests/unit/components/sites/stock/car-categories.test.ts` | Heurística + parsing CSV + tokens inválidos. |
| `tests/unit/components/sites/stock/StockGrid.test.tsx` | Render, reuso do `<CarCard>`, hrefs, BRL, WhatsApp inline, raio 8px e alt textual. |
| `tests/unit/components/sites/stock/StockFilter.test.tsx` | Toggle, ordem URL determinística, a11y. |
| `tests/unit/components/sites/stock/StockSection.test.tsx` | Filter cases, empty state, sort, paginação e axe-core runtime. |
| `tests/unit/components/sites/stock/StockHeroMini.test.tsx` | H1, contagem e passagem AI-citable após h1. |
| `tests/unit/components/sites/stock/StockSearchBar.test.tsx` | Busca, sort Radix, botão mobile e callbacks. |
| `tests/unit/components/sites/stock/StockSortDropdown.test.tsx` | 5 opções públicas e callback de seleção. |
| `tests/unit/components/sites/stock/StockPagination.test.tsx` | Desktop numbered, limites prev/next e load-more mobile. |
| `tests/unit/components/sites/stock/StockFilterSidebar.test.tsx` | 10 sections, default expanded, badges, callbacks e axe. |
| `tests/unit/components/sites/stock/StockFilterDrawer.test.tsx` | Vaul aberto, DialogTitle, max-height, fechar e axe. |
| `tests/unit/components/sites/stock/CarGallery.test.tsx` | Trigger → dialog open, close, thumb active. |
| `tests/unit/components/sites/stock/CarDetailSection.test.tsx` | Preço no `<DetailPriceBlock>`, CTAs `detail-cta-primary`, datasheet, description XSS, prefillModel, axe-core. |
| `tests/unit/components/sites/stock/DetailBreadcrumb.test.tsx` | Breadcrumb visual shared, links de estoque/marca e página atual. |
| `tests/unit/components/sites/stock/DetailGalleryCinema.test.tsx` | Scroll-snap, alt text, contador `aria-live`, lightbox Radix, teclado e axe aberto/fechado. |
| `tests/unit/components/sites/stock/DetailInfoBlock.test.tsx` | H1, AI-citable, badges, descrição escapada e axe. |
| `tests/unit/components/sites/stock/DetailSpecGrid.test.tsx` | Grid híbrido, allowlist de datasheet e omissão de opcionais ausentes. |
| `tests/unit/components/sites/stock/DetailCtaStack.test.tsx` | CTAs vehicle + `utm_content`, indisponível, axe. |
| `tests/unit/components/sites/stock/DetailFinancingCalcInline.test.tsx` | Calculadora inline, recálculo, deep-link financing, axe. |
| `tests/unit/components/sites/stock/DetailPriceBlock.test.tsx` | Sticky, preço/parcela/consulta, vendido, financing aninhado, axe. |
| `tests/unit/app/sites/estoque/page.test.tsx` | Status routing + searchParams handling. |
| `tests/unit/app/sites/estoque/carDetailPage.test.tsx` | Status routing + `cars.find` 404 + metadata. |
| `tests/e2e/sites/detail-d1.spec.ts` | D1 afetado: breadcrumb, galeria/info/spec e lightbox preservando scroll. |

## Dependências

- `next/link`, `next/image` (`unoptimized` por causa do CDN não-whitelisted).
- `lucide-react` (`X` no botão de fechar do lightbox).
- `@/types/lead-site` (`SiteVariables`, `SiteCar`).
- `@/components/sites/SiteForm` (variant `'car-detail'`).

Sem deps novas — sem libs de lightbox, sem libs de filtro.

## Quando atualizar este `CLAUDE.md`

- Novo componente em `stock/`.
- Mudança no contrato de filtro (ex.: novo eixo além de categoria).
- Mudança na classificação heurística (ex.: novo `CarCategorySlug`).
- Quando `SiteCar` ganhar campo `category` próprio (substituirá a
  heurística aqui — `classifyCar` deprecado).
