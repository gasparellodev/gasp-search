# `tests/e2e/sites/` — Spec Técnica (Phase 7 #166)

## Propósito

E2E Playwright cobrindo o pipeline completo de **render** dos sites
gerados (Phase 7 — concessionárias):
geração persistida → render das 6 rotas públicas → navegação → routing
por status. Não chama IA/Apify reais.

## Estrutura

```
tests/e2e/sites/
├── CLAUDE.md             # este arquivo
├── helpers.ts            # seedSite/cleanupSite/getValidVariables
├── generation.spec.ts    # AC2 — pipeline + DB persistence
├── rendering.spec.ts     # AC3 — 6 rotas (h1 + meta noindex)
├── navigation.spec.ts    # AC4 — clicks no SiteHeader
├── header-glass.spec.ts   # #218 — glass-sticky + MobileNav fullscreen
├── floating-whatsapp.spec.ts # #220 — CTA flutuante + barra mobile detail
├── cookie-consent.spec.ts # #234 — banner LGPD + persistência localStorage
├── stock-filter.spec.ts # #224 — filtros URL/shareable + drawer mobile
├── detail-d1.spec.ts     # #226 — breadcrumb, galeria cinema/lightbox, info e spec grid
├── detail-d3.spec.ts     # #228 — Tradein widget + Similar vehicles + FAQ contextual + ordem visual
├── about-anchor.spec.ts  # #229 — deep-link `/sobre#garantia` com offset do header sticky
└── status-routing.spec.ts# AC5 — draft/archived → 404
```

## Estratégia de seed

Os specs usam a **rota test-only** `POST /api/e2e-seed/seed-lead-site`
em vez de invocar `generateLeadSite` (Anthropic + Apify) ou rodar UI de
admin. Vantagens:

- ✅ Determinístico: o fixture `validSiteVariablesFixture` define
  exatamente o que será renderizado.
- ✅ Rápido: ~50ms por seed, vs minutos pra IA real.
- ✅ Sem segredos: não precisa de `ANTHROPIC_API_KEY` válido em CI.
- ✅ Não polui dados de produção: gateado em `NODE_ENV !== 'production'`.

Cada `beforeEach` cria um slug único via `makeTestSlug(prefix)` (sufixo
randômico de `crypto.randomUUID()`) pra evitar colisão na unique global
`lead_sites_slug_uniq`. `afterEach` chama `cleanupSite` que faz DELETE
via mesma rota — remove `lead_sites` row + `lead` pai associado (FK
cascade não é usado aqui pra deixar 0 lixo no banco).

## Modelo de segurança da rota test-only

A rota `app/api/e2e-seed/seed-lead-site/route.ts` tem **três gates** em
sequência:

1. **`process.env.NODE_ENV === "production"` → 404.** Em prod a rota
   "desaparece". Esse gate é airtight: o handler verifica antes de
   qualquer parsing/validação. Quem chamar `?token=...` em prod recebe
   o mesmo `404` que uma rota inexistente.
2. **`TEST_SEED_TOKEN` ausente → 503.** Sem token configurado a rota
   responde "test_seed_disabled" — útil pra debugging em dev.
3. **`?token` query param ≠ `TEST_SEED_TOKEN` → 401.** Comparação
   trivial; o token é shared secret de dev/test, nunca commitado.

Adicionalmente, `TEST_SEED_USER_ID` é obrigatório porque
`leads.user_id` referencia `auth.users.id` — o seed precisa apontar
pra um user real. Em CI esse user é criado via setup; localmente o dev
usa o próprio user de auth.

**O service role é OK aqui** porque (a) gate triplo, (b) surface
narrow (single insert + single delete por slug), (c) não roda em prod.

## Como adicionar specs

- Use `seedSite(request, { slug, status, variables? })` no `beforeEach`.
- Chame `cleanupSite(request, { slug })` no `afterEach` — mesmo se o
  teste falhou (evita deixar lixo). O helper é tolerante a falhas
  (warn em vez de throw).
- Use `getValidVariables(overrides?)` quando precisar customizar
  campos da fixture sem importar `validSiteVariablesFixture`
  diretamente.
- Wrap com `test.skip(!sitesE2EEnabled(), "...")` no topo do
  `describe` — em CI sem env vars, os specs são pulados em vez de
  falharem.

## Variáveis de ambiente necessárias

| Var | Onde | Notas |
|---|---|---|
| `TEST_SEED_TOKEN` | server (test/dev only) | ≥16 chars; gateia a rota |
| `TEST_SEED_USER_ID` | server (test/dev only) | UUID; deve existir em `auth.users` |
| `NEXT_PUBLIC_SUPABASE_URL` | server + client | precisa apontar pra Supabase real (não placeholder) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | server + client | idem |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | idem (rota usa service_role pra bypass RLS) |

Em CI sem essas vars, todos os specs são `test.skip`. Quando o time
provisionar Supabase de teste em CI, os secrets serão adicionados em
`.github/workflows/ci.yml` no job `e2e` e os specs passam a rodar.

## Quando atualizar este `CLAUDE.md`

- Nova rota `/sites/[slug]/...` cobrir → adicionar spec aqui.
- Mudança no contrato de seed (campos novos em `lead_sites`) →
  atualizar `helpers.ts` e este arquivo.
- Mudança no modelo de gate (e.g., adicionar HMAC) → atualizar a
  seção "Modelo de segurança".
