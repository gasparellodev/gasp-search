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

## Regras de negócio

1. **Logo é `<Image>` de `next/image` com `unoptimized`.** O CDN dos
   logos (Cloudflare R2 / Supabase Storage) não está no whitelist de
   `next.config.js` — `unoptimized` evita 502 em build.
2. **Links internos via `next/link`.** `<a>` cru só pra externos
   (sociais, WhatsApp, mailto).
3. **Links externos** sempre com `target="_blank"` e
   `rel="noopener noreferrer"` (a11y + segurança contra reverse
   tabnabbing).
4. **Newsletter no Footer é VISUAL ONLY.** Sem submit handler real, sem
   `name` no input, botão `disabled`. A persistência fica para issue
   follow-up — spec §15 não exige captura de newsletter no MVP.
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
| `SitePage.tsx` | **Server Component (stub M2.1 — issue #160).** Wrapper público de `/sites/[slug]`. Recebe `{ variables: SiteVariables, siteId: string, slug: string }`. Injeta CSS vars `--site-primary` / `--site-text-on-primary` (sanitizadas via `sanitizeHex`). MVP renderiza apenas `<h1>` com `business_name` + `data-site-id` para E2E. **Composição completa** (Hero / Categories / Emphasis / RecentSales / About / Contact / Stock / CarDetail) entra em M2.3-M2.5 (issues #162-#164) — a API de props `{ variables, siteId, slug }` é estável e não muda no swap stub→full. |
| `SiteHeader.tsx` | Server Component. Logo + nav desktop com 4 links + variant ativo (`Pick<SiteVariables, 'business_name'\|'logo_url'\|'primary_color'\|'text_on_primary'>` + `slug` + `activePage`). Mobile delega ao `<MobileNav>`. |
| `MobileNav.tsx` | **Client Component.** Hambúrguer + menu dropdown com estado `open`. ESC fecha + foco volta ao botão. |
| `SiteFooter.tsx` | Server Component. 3 colunas: marca/sociais, contato, newsletter (visual). Ícones sociais omitidos individualmente quando URL é `null`. Copyright com ano corrente. |
| `SiteForm.tsx` | **Client Component.** Form de captura com 3 variantes (`'home'`/`'contact'`/`'car-detail'`). `react-hook-form` + `zodResolver`. `model` read-only quando `variant='car-detail'` com `prefillModel`. LGPD checkbox obrigatório. |
| `social-icons.tsx` | SVGs inline de Instagram/Facebook/YouTube/WhatsApp — `lucide-react@^1.14` removeu os ícones de marca por trademark. Pure server-renderable. |
| `site-nav-links.ts` | Pure data (`buildSiteNavLinks(slug)` + tipos). Compartilhado entre `SiteHeader` (server) e `MobileNav` (client). |

## Boundary client/server

```
┌─ SiteHeader (server) ────────────────┐
│  logo + nav desktop (server-render)  │
│  ┌─ MobileNav (client) ─────────┐    │
│  │  hambúrguer + menu state     │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘

┌─ SiteFooter (server) ──── pure server ┐
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
- `lucide-react@^1.14` (ícones genéricos: `Menu`, `X`, `ArrowRight`,
  `Loader2`). Brand icons em `social-icons.tsx`.
- `next/link`, `next/image`.
- `@/lib/sites/sanitize` — defesa em profundidade pra cores hex.

## Quando atualizar este `CLAUDE.md`

- Novo Site Component (`SiteHero`, `SiteCard`, etc.) na pasta.
- Mudança no contrato de props de algum componente já existente.
- Mudança na fronteira client/server (ex: extrair novo client sub-component).
