# `components/sites/about/` — Sections da rota `/sobre` (Phase 7)

## Propósito

Sub-componentes que compõem a página Sobre do site público
(`/sites/<slug>/sobre`) — issue #163, redesenhada em #229. Cada arquivo é uma seção
isolada com responsabilidade estreita, consumida pela rota raiz
`/sites/[slug]/sobre/page.tsx` que injeta a section dentro do
`<SitePage>` via children.

## Como adicionar

- 1 arquivo por seção, em PascalCase com prefixo `About` (ex:
  `AboutHeroEditorial.tsx`, `AboutTeam.tsx` — quando virem).
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
| `AboutHeroEditorial.tsx` | Hero editorial da página Sobre (#229): `data-testid="about-hero-editorial"`, `min-h-[50dvh] md:min-h-[60dvh]`, `<h1>` único "Sobre a {business_name}", tagline (`slogan` → cidade → fallback) e primeiro parágrafo de `about_text`. Foto via `manifestAboutUrl ?? brand_assets.about_image_url ?? /assets/about/porsche-model.png`. |
| `AboutMissionVision.tsx` | Grid 1 coluna mobile / 3 colunas desktop com `<article>` Missão, Visão e Valores. Lê `variables.mission`, `variables.vision` e `variables.values` direto, sem fallback hardcoded. Preserva testids `about-mission`, `about-vision`, `about-values`. |
| `AboutTimeline.tsx` | Timeline vertical de marcos do negócio (#P5 reescopado). Props: `entries: TimelineEntry[]` + `businessName: string`. Retorna `null` quando `entries.length === 0` (graceful absence). Schema (`variables.timeline`) não existe em `SiteVariablesV2` V1 — caller passa `[]` como fallback seguro; quando schema for estendido, remover o fallback do caller. `data-reveal` nos itens para choreography de motion. `aria-labelledby="timeline-heading"`. |
| `AboutTeam.tsx` | Grid de membros da equipe 1/2/3 colunas (#P5 reescopado). Props: `members: TeamMember[]`. Retorna `null` quando `members.length === 0`. Schema (`variables.team`) não existe em `SiteVariablesV2` V1 — mesmo padrão de fallback do `AboutTimeline`. Foto com `alt="Foto de {name}"` via `next/image`; omite `<img>` quando `photo_url` é `null`/`undefined`. Hover lift via `hover:shadow-md hover:scale-[1.02]`. `aria-labelledby="team-heading"`. |
| `AboutWarrantyDeepdive.tsx` | Section `id="garantia"` com `data-testid="about-warranty-deepdive"` e `scroll-mt-20` para deep-link abaixo do header sticky. Renderiza 3 cards de processo do canon `lib/sites/warranty-process.ts`. |

`/sobre/page.tsx` também reutiliza diretamente `HomeGoogleReviewsEmbed` e
`HomeContactFormQuick` de `components/sites/home/`; os testids `home-*`
permanecem porque o reuso é por composição, não por rename.

## Boundary client/server

```
AboutHeroEditorial   (server) ─── pure server
AboutMissionVision   (server) ─── pure server
AboutTimeline        (server) ─── pure server
AboutTeam            (server) ─── pure server
AboutWarrantyDeepdive (server) ── pure server
```

Tudo é Server Component. Não há ilha interativa nesta seção.

## Dependências

- `next/image` — `AboutHeroEditorial` e `AboutTeam` (foto dos membros).
- `lucide-react` — ícones do deep-dive de garantia.
- `@/lib/sites/warranty-process` — canon dos 3 cards de garantia.
- `@/lib/utils` — `cn()` em `AboutTimeline`.
- `@/types/lead-site.SiteVariables` — tipos do payload (subset via
  `Pick`).

## Schema pendente

`variables.timeline` e `variables.team` **não existem** em
`SiteVariablesV2` V1. Tanto `AboutTimeline` quanto `AboutTeam` aceitam
`entries: []` / `members: []` respectivamente e retornam `null` — nenhum
shell vazio no DOM. O caller (`/sobre/page.tsx`) passa `[]` explicitamente
até que o schema seja estendido numa issue futura. Ao estender:
1. Adicionar campos opcionais em `types/lead-site.ts` (`SiteVariablesV2`).
2. Substituir os `[]` fixos no caller pelo acesso real `variables.timeline ?? []`.
3. Atualizar este CLAUDE.md.

## Quando atualizar este `CLAUDE.md`

- Nova seção da Sobre adicionada.
- Mudança no contrato de props.
- Schema `variables.timeline` / `variables.team` for estendido.
- Novo ramo de boundary client/server (ex: ilha interativa em carousel).
