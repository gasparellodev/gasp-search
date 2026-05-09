# `app/sites/` — Rotas públicas dos sites de leads (Phase 7)

## Propósito

Rotas dinâmicas (Next App Router) que renderizam os sites públicos
gerados pelo Site Generator. URL canônica:
`gasp-search.com/sites/<slug>`.

Diferente de `app/(app)/...` (área autenticada do GaspLab):

- **Sem auth.** O acesso é por slug global único (privacy-by-obscurity).
- **Service-role** confinado: a leitura usa `createServiceSupabase`
  (server-only) porque não há `auth.uid()` para a RLS resolver.
- **`noindex`** obrigatório — site de lead não vai pra SERP.

Fonte canônica do design: §8 do spec mestre em
`docs/superpowers/specs/2026-05-08-gerador-sites-concessionarias-design.md`.

## Como adicionar

- **Página de site** (`/sites/[slug]/sobre`, `/sites/[slug]/contato`,
  etc.): arquivo `app/sites/[slug]/<rota>/page.tsx`. Reutiliza
  `getSite(slug)` do `page.tsx` raiz (idealmente extraído pra
  `lib/sites/get-site.ts` quando >1 caller existir — issues #162-#164).
- **Components** que renderizam o conteúdo (Hero, Categories, etc.)
  vivem em `components/sites/`.
- **Server Components por padrão.** O Site Generator é static-friendly
  (sem cookies, sem auth) — qualquer 'use client' deve ter justificativa.

## Regras de negócio

1. **`'use cache'` directive** em todas as queries Supabase desta área.
   Sem isso, cada request bate o banco — caro e lento. Sempre acompanhar
   de `cacheTag(\`site:\${slug}\`)` para invalidação targeted.
2. **`cacheLife({ revalidate: 3600, expire: 86400 })`** é o profile
   padrão pra sites: stale-while-revalidate por 1h, expire em 24h.
   Sites editados pela ficha do lead invalidam manualmente via
   `updateTag('site:<slug>')` em `app/actions/lead-site.ts`.
3. **Service-role só aqui (e em `app/actions/lead-site.ts` + handler do
   webhook do WhatsApp).** Allowlist enforced via grep:
   `rg -l 'createServiceSupabase|SUPABASE_SERVICE_ROLE_KEY' --type ts --type tsx | sort`
   deve retornar exatamente:
   - `lib/supabase/service.ts` (definição)
   - `lib/sites/get-site.ts` (helper compartilhado pelas rotas públicas — extraído em #163)
   - `app/actions/lead-site.ts` (caller server-action)
   - `app/api/whatsapp/webhook/route.ts` (handler webhook HMAC-verificado)
   - `lib/env.ts` (validador da env)
   - arquivos de teste (`tests/...`)
   As rotas em `app/sites/[slug]/...` consomem `getSite` por dependência;
   nenhuma toca `createServiceSupabase` direto.
4. **`SiteVariables.safeParse` antes do render.** Defesa em
   profundidade — se a IA gravou JSON quebrado em
   `lead_sites.variables`, a página cai em `notFound()` em vez de
   crashar o React rendering. Logamos `slug` + paths Zod (sem PII).
5. **Routing por status** (per spec §4):
   | Status | Visitante vê |
   |---|---|
   | `null` (slug missing) | 404 |
   | `draft` | 404 |
   | `archived` | 404 (V1 — TODO 410 V2) |
   | `published` | site renderizado |
   | `sent` | site renderizado |
6. **`metadata.robots = { index: false, follow: false }`.** Hardening
   adicional via `X-Robots-Tag` header em V2.
7. **Sem PII em logs.** Nunca logar `variables` cru, `business_name`,
   `email`, telefone, ou copy gerada — o site contém todos esses dados.

## Arquivos

| Path | Propósito |
|---|---|
| `[slug]/page.tsx` | Rota raiz `/sites/<slug>`. `getSite(slug)` (de `lib/sites/get-site.ts`) cacheado + status routing + Zod validation + `<SitePage>` (renderiza Home composition). |
| `[slug]/sobre/page.tsx` | Rota `/sites/<slug>/sobre` (#163). Reutiliza `getSite` + `<SitePage activePage="sobre">` com `<AboutSection>` injetado via children. |
| `[slug]/contato/page.tsx` | Rota `/sites/<slug>/contato` (#163). Reutiliza `getSite` + `<SitePage activePage="contato">` com `<ContactSection>` injetado via children. |
| `[slug]/anunciar/page.tsx` | Rota `/sites/<slug>/anunciar` (#163). Reutiliza `getSite` + `<SitePage activePage="anunciar">` com `<AdvertiseSection>` (server) + `<AnnounceForm>` (client) injetados via children. |

> Páginas filhas (estoque/carro) são adicionadas em M2.5 (issue #164).

## Dependências

- `next/cache` — `cacheTag`, `cacheLife`.
- `next/navigation` — `notFound`.
- `@/lib/supabase/service` — `createServiceSupabase`.
- `@/types/lead-site` — `SiteVariables` (Zod).
- `@/components/sites/SitePage` — wrapper de render.

## Quando atualizar este `CLAUDE.md`

- Nova subrota (`/sites/[slug]/sobre`, etc.) for adicionada.
- Estratégia de cache mudar (TTL, profile diferente).
- Allowlist de service-role for ampliada (precisa justificativa
  documentada no PR).
- Routing por status mudar (V2 410 Gone para archived).
