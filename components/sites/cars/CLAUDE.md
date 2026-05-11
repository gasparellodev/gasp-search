# `components/sites/cars/` — Shared building blocks de veículos (Phase 7 #201)

## Propósito

Componentes **compartilhados** que renderizam cards/blocos de veículos no
Site Generator premium (Sprint 0+). Reusados por:

- `<StockGrid>` (Sprint 5 — E2): grid de listagem em `/estoque`.
- `<HomeFinancingWidget>` companion (Sprint 4 — H2): card no Hero.
- `<CarDetail>` price-block + Similar vehicles (Sprint 6 — D2, D3).

Diferença vs `components/sites/stock/`:

- `stock/` é **page-level** (compõe section + filtro + grid de um `/estoque`).
- `cars/` é **component-level** (peças isoladas que aparecem em múltiplas
  páginas).

## Como adicionar

- 1 arquivo por componente, PascalCase (`CarCard.tsx`, `CarPriceBlock.tsx`).
- **Shared client/server-safe por padrão quando o card aparecer dentro de
  surfaces client.** Cards são puros (props in → JSX out), sem hooks e sem I/O.
  Não usar `server-only` em componentes que precisem ser importados por
  `StockClientView` ou outro orchestrator client.
- Tokens **via CSS vars** `var(--auto-*)` — NÃO classes Tailwind genéricas
  (`bg-foreground`). Site público vive sob `[data-theme="auto-showroom"]`
  injetado por `<SitePage>`. Tokens declarados em `app/globals.css`
  (`--auto-radius-md`, `--auto-font-display`, `--auto-duration-base`,
  `--auto-ease-out`, `--auto-whatsapp`, etc.).
- `data-testid="<component>-<car.slug>"` no elemento raiz para compatibilidade
  com seletores E2E.

## Regras de negócio

1. **Foto canônica é `car.thumbnail_url`** (presente em v1 + v2). Não usar
   `photos[0]` (v2-only) — quebra v1 legado.
2. **WhatsApp link NÃO pode estar aninhado dentro de `<Link>` interno**.
   HTML inválido + screen readers tropeçam. Estrutura: `<article>` contém
   `<Link>` (foto+info) E `<a>` WhatsApp lado-a-lado.
3. **Installment defaults** vêm de `lib/finance.ts`
   (`DEFAULT_CARD_INSTALLMENT_MONTHS`, `DEFAULT_CARD_DOWN_PCT`,
   `DEFAULT_MONTHLY_INTEREST`). Caller (H2 widget) pode override.
4. **Hover lift** via `hover:-translate-y-0.5` + transition tokens
   (250ms ease-out). **Sem `shadow-*` no resting state** (DESIGN.md
   §Elevation: border + lift, não drop shadow).
5. **Sem `id` no `SiteCar`** — `slugifyVehicle` em `lib/finance.ts` deriva
   de `{brand, model, year}` apenas. Em `<CarCard>`, usar `car.slug` direto
   (já vem normalizado upstream).

## Arquivos

| Path | Propósito |
|---|---|
| `CarCard.tsx` | Card de veículo padrão (foto 4:3 + eyebrow brand + h3 model/year + km·fuel·transmission + price + installment + botão WhatsApp). Shared client/server-safe desde #225 porque `<StockClientView>` é client e reutiliza `<StockGrid>`. Props: `{ car, siteSlug, whatsappPhone, businessName }`. Tokens `var(--auto-*)`. Aria-labelledby para h3. WhatsApp link via `buildWhatsAppLink({ template: 'vehicle', component: 'stock-card' })` em footer separado (não-nested). |

## Dependências

- `next/link`, `next/image` (`unoptimized` por causa do CDN não-whitelisted).
- `@/lib/finance` — `calculateInstallment`, `formatBRL`, defaults de card.
- `@/lib/whatsapp` — `buildWhatsAppLink` (template `'vehicle'`).
- `lucide-react` — `MessageCircle` (ícone do botão WhatsApp).

## Quando atualizar este `CLAUDE.md`

- Novo card/bloco compartilhado entre páginas (`CarPriceBlock`, `CarThumb`, etc.).
- Mudança no contrato de props de algum componente já existente.
- Mudança em tokens consumidos (adicionar/remover `var(--auto-*)`).
