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

1. **HomeHero CTA** → `/sites/<slug>/estoque` (sem querystring).
2. **HomeCategories card** → `/sites/<slug>/estoque?categoria=<slugify(label)>`.
   - O filtro `?categoria=` é responsabilidade da página `/estoque`
     (#164). Se ainda não existir quando #162 mergear, links abrem a
     listagem completa — fallback safe.
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

## Arquivos

| Path | Propósito |
|---|---|
| `HomeHero.tsx` | **Light hero Figma-fiel** (redesign 2026-05-09). Layout 2-cols `md:grid-cols-[1fr_1.5fr]` (60% pra imagem) com `bg-background` (branco), slogan `<h1>` em `text-foreground` (preto) com `clamp(2.5rem, 7vw, 5rem)` à esquerda, CTA pill com `primary_color` do lead via `style={{ backgroundColor: sanitizeHex(...) }}`, cutout do carro via `resolveHeroImageUrl(hero_image_url)` — usa `hero_image_url` do lead ou cai em `SITE_ASSETS.hero.demoCarCutout` (Porsche cinza). `<Image>` com `object-contain object-center`, altura `md:h-[520px] lg:h-[600px]`. Mobile: stack vertical. Chevron-down decorativo (`aria-hidden`) abaixo do hero. **Pré-requisito**: cutout deve ser PNG com fundo transparente — fundo branco se confunde com a página. |
| `HomeCategories.tsx` | Grid 3-cols (1-col mobile) com cards-imagem e `ChevronRight`. Cada card linka a `/estoque?categoria=<slugify>`. |
| `HomeForm.tsx` | Wrapper Server sobre `<SiteForm>` (Client) que injeta o título canônico da Home + `variant='home'`. |
| `HomeEmphasis.tsx` | "Em destaque" 2-cols: imagem left + card alabaster (rounded 25px) com title/car_name/description (`pre-line`). |
| `HomeRecentSales.tsx` | 3 cards horizontais: grid desktop / scroll-snap mobile. Cada card: imagem + car_name + `CheckCircle`. |

## Boundary client/server

```
HomeHero (server) ─── pure server
HomeCategories (server) ─── pure server
HomeForm (server) ───┐
                     └─ delega ao <SiteForm> (client) ── react-hook-form
HomeEmphasis (server) ─── pure server
HomeRecentSales (server) ─── pure server
```

Apenas `HomeForm` toca a borda client (delegação ao `<SiteForm>` que
mantém estado de form). Tudo o resto é puro server-render.

## Dependências

- `next/image` + `next/link`.
- `lucide-react@^1.14` (`ChevronRight`, `CheckCircle`).
- `@/lib/sites/sanitize.sanitizeHex` — defesa em profundidade pra
  cores hex.
- `@/lib/utils/slug.slugify` — gera o querystring de
  `?categoria=<slug>`.
- `@/lib/sites/site-assets.SITE_ASSETS` — `hero.texture` (decorativa
  fixa) e `hero.demoCarCutout` (fallback do Pulse). Editar paths
  globais em `lib/sites/site-assets.ts`.
- `@/lib/sites/site-assets.resolveHeroImageUrl` — `hero_image_url`
  do lead ou demo cutout global.
- `@/types/lead-site.SiteVariables` — tipos do payload (campos
  consumidos via `Pick`).
- `../SiteForm` — wrapper client do form de captura.

## Quando atualizar este `CLAUDE.md`

- Nova seção da Home (`HomeNewsletter`, `HomeStats`, etc.).
- Mudança na ordem das seções em `<SitePage>`.
- Mudança no contrato de props de qualquer Home component.
- Novo ramo de boundary client/server (ex: ilha interativa dentro de
  `HomeHero`).
