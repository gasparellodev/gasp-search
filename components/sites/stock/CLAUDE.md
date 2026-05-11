# `components/sites/stock/` — Estoque + Detalhe-do-carro (Phase 7 #164)

## Propósito

Componentes que renderizam:

- **Lista de estoque** (`/sites/<slug>/estoque`) — `<StockSection>` orquestra
  `<StockFilter>` (multi-select) + `<StockGrid>` (cards) + empty state.
- **Detalhe do carro** (`/sites/<slug>/estoque/<carSlug>`) —
  `<CarDetailSection>` com `<CarGallery>` (lightbox `<dialog>` nativo),
  badges, datasheet `<dl>`, descrição com `whitespace-pre-line` e
  `<SiteForm variant="car-detail">` aninhado.

Reutiliza `<SitePage>` parent (CSS vars já injetadas) e `<SiteForm>`
existente (variant `'car-detail'`).

## Boundary client/server

```
┌─ StockSection (server) ────────────────────┐
│  parseCategoriaParam → filter → toSorted   │
│  ┌─ StockFilter (client) ────────┐         │
│  │  router.push em toggle        │         │
│  └───────────────────────────────┘         │
│  ┌─ StockGrid (server) ──────────┐         │
│  │  pure render N <Link> cards   │         │
│  └───────────────────────────────┘         │
└────────────────────────────────────────────┘

┌─ CarDetailSection (server) ────────────────┐
│  hero header + badges + WhatsApp CTA       │
│  ┌─ CarGallery (client) ─────────┐         │
│  │  <dialog> lightbox + thumbs   │         │
│  └───────────────────────────────┘         │
│  <dl> datasheet + <SiteForm/>              │
└────────────────────────────────────────────┘
```

## Como adicionar / modificar

- 1 arquivo por componente. PascalCase.
- **Server por padrão**; `'use client'` só em `StockFilter` (`useRouter`,
  `useTransition`) e `CarGallery` (`useRef` para `<dialog>`,
  `useState` para `activeIdx`/`open`).
- **Sempre `import 'server-only'`** em arquivos server-only.
- **Acesso a `cars[]`**: tipos via `Pick<SiteVariables, ...>` quando o
  componente só consome um subset (CarDetailSection usa `business_name`,
  `whatsapp`, `phone_display`, `primary_color`, `text_on_primary` —
  o `car` em si é separado).
- **Sem dangerouslySetInnerHTML**. `car.description` em `<p
  whitespace-pre-line>` (preserva quebras `\n`).
- **Sem libs de lightbox externas.** `<dialog>` HTML nativo cobre focus
  trap, ESC, backdrop. Polyfill (Safari < 15.4) fica para V2.
- **URLs externas**: sempre `target="_blank" rel="noopener noreferrer"`.

## Regras de negócio específicas

1. **Filtro `?categoria=` (CSV multi-select)**: `parseCategoriaParam`
   retorna `Set<CarCategorySlug>` ou `null`. Tokens inválidos viram
   no-op (lista todos) — input adversarial nunca causa 500.
2. **Classificação heurística** via `classifyCar(car)` (`car-categories.ts`):
   match por keyword em `brand+model` normalizado (NFKD lowercase). Ordem
   importa — `picape > esportivo > suv > sedan > hatch`. Carros que não
   batem retornam `null` e ficam **fora** quando há filtro ativo.
3. **Featured-first**: ordenação imutável via `cars.toSorted((a,b) =>
   Number(b.featured) - Number(a.featured))`. ES2023 garantido (Node 24).
4. **Empty state**: 0 matches → mensagem PT-BR + Link para
   `/sites/<slug>/estoque` (sem `?categoria`).
5. **BRL price**: `Intl.NumberFormat('pt-BR', { style: 'currency',
   currency: 'BRL', maximumFractionDigits: 0 })`. Quando `price === null`
   → "Sob consulta".
6. **WhatsApp CTA** em `<CarDetailSection>`: `https://wa.me/<digits>?text=
   <encoded>` com `aria-label` descritivo. Mensagem template "Olá, tenho
   interesse no <brand> <model> <year>".
7. **`<dialog>` lightbox**: `dialogRef.current?.showModal()` abre,
   `.close()` fecha. Listener no evento `close` restaura foco no trigger.
8. **`<SiteForm variant="car-detail" prefillModel="<brand> <model>">`**
   inline no fim do detalhe. Reusa o componente já existente em
   `components/sites/SiteForm.tsx` — campo `model` fica read-only.

## Arquivos

| Path | Propósito |
|---|---|
| `StockSection.tsx` | Server. Orquestra parsing + filter + sort + render. Empty state PT-BR + link "Ver todos". **#214 (GEO):** injeta `<AICitableHero page="estoque" variables={...}>` após o `<h1>` Estoque, sempre visível mobile. |
| `StockFilter.tsx` | **Client.** Checkbox multi-select. `router.push` em toggle. `useTransition` pra UI feedback. `role=group` + `<legend>`. |
| `StockGrid.tsx` | Server. Grid 1/2/3 cols, cards com `data-testid="car-card-<slug>"`. BRL + KM via `Intl`. Badge "Destaque" condicional. |
| `CarDetailSection.tsx` | Server. Hero (galeria + info + CTA WhatsApp + descrição) + datasheet `<dl>` + `<SiteForm variant="car-detail">`. **#214 (GEO):** injeta `<AICitableHero page="detalhe" currentCar={...}>` após o `<h1>` model/year; `Pick<SiteVariablesV2, ...>` extendido com `address`+`cars` pra alimentar a frase factual. **#220:** a barra mobile fixed vive fora deste section, no caller da rota, para receber `car` já resolvido sem transformar o section em client. |
| `CarGallery.tsx` | **Client.** Imagem principal + thumbs + `<dialog>` lightbox. `dialogRef` + ESC + restauração de foco. |
| `car-categories.ts` | Pure helpers — `classifyCar(car)`, `parseCategoriaParam(raw)`, type `CarCategorySlug`. |

## Testes

| Path | Cobertura |
|---|---|
| `tests/unit/components/sites/stock/car-categories.test.ts` | Heurística + parsing CSV + tokens inválidos. |
| `tests/unit/components/sites/stock/StockGrid.test.tsx` | Render, BRL, badge, hrefs, alt textual. |
| `tests/unit/components/sites/stock/StockFilter.test.tsx` | Toggle, ordem URL determinística, a11y. |
| `tests/unit/components/sites/stock/StockSection.test.tsx` | Filter cases, empty state, featured-first, axe-core runtime. |
| `tests/unit/components/sites/stock/CarGallery.test.tsx` | Trigger → dialog open, close, thumb active. |
| `tests/unit/components/sites/stock/CarDetailSection.test.tsx` | WhatsApp CTA, datasheet, description XSS, prefillModel, axe-core. |
| `tests/unit/app/sites/estoque/page.test.tsx` | Status routing + searchParams handling. |
| `tests/unit/app/sites/estoque/carDetailPage.test.tsx` | Status routing + `cars.find` 404 + metadata. |

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
