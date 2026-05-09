# `components/sites/about/` — Section da rota `/sobre` (Phase 7)

## Propósito

Sub-componentes que compõem a página Sobre do site público
(`/sites/<slug>/sobre`) — issue #163. Cada arquivo é uma seção
isolada com responsabilidade estreita, consumida pela rota raiz
`/sites/[slug]/sobre/page.tsx` que injeta a section dentro do
`<SitePage>` via children.

## Como adicionar

- 1 arquivo por seção, em PascalCase com prefixo `About` (ex:
  `AboutSection.tsx`, `AboutTeam.tsx` — quando virem).
- **Sempre Server Component.** `import "server-only";` na linha 1.
- **Props com subset explícito** (`Pick<SiteVariables, ...>` ou
  interface dedicada). Não passar `variables` inteiro.
- **Texto longo IA** sempre via `split('\n\n').map((p, i) => <p
  key={i}>{p}</p>)`. **NUNCA** `dangerouslySetInnerHTML`. **NUNCA**
  `react-markdown`. Quebras de linha ficam por conta do CSS
  (`whitespace-pre-line` ou parágrafos React).
- **Imagens com `next/image fill` + `unoptimized`** (CDN externo
  fora do whitelist) e `alt` descritivo (`Sobre — <business_name>`).

## Regras de negócio

1. **Anti-XSS**: zero raw HTML interpolation, `dangerouslySetInnerHTML`,
   ou `react-markdown`. Texto IA sempre como children React seguros.
2. **Empty paragraph filtering**: `split('\n\n')` pode gerar entries
   vazias quando o texto contém `\n\n\n\n`. Filtramos via
   `.filter(Boolean)` — defesa contra `<p></p>` no DOM.
3. **`<h1>` único** na página: a section possui o `<h1>` da Sobre
   ("Sobre a {business_name}"). Sub-cards usam `<h2>`.
4. **Mission/Vision/Values em cards `<article>`** com `data-testid`
   estável (`about-mission`, `about-vision`, `about-values`) para
   E2E + RTL.

## Arquivos

| Path | Propósito |
|---|---|
| `AboutSection.tsx` | Section principal: hero (image + h1 + about_text dividido em parágrafos) + 3 cards (Missão, Visão, Valores). Recebe `Pick<SiteVariables, 'about_text'\|'about_image_url'\|'mission'\|'vision'\|'values'\|'business_name'>`. |

## Boundary client/server

```
AboutSection (server) ─── pure server
```

Tudo é Server Component. Não há ilha interativa nesta seção.

## Dependências

- `next/image`.
- `@/types/lead-site.SiteVariables` — tipos do payload (subset via
  `Pick`).

## Quando atualizar este `CLAUDE.md`

- Nova seção da Sobre (`AboutTeam`, `AboutTimeline`, etc.).
- Mudança no contrato de props.
- Novo ramo de boundary client/server (ex: ilha interativa em
  carousel).
