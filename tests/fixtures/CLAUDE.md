# `tests/fixtures/` — Spec Técnica

## Propósito

Fixtures sintéticos compartilhados entre suites de teste (unit + integration).
São reusáveis por múltiplos arquivos `*.test.ts` para evitar duplicação de
payloads grandes e padronizar o "shape válido" de cada domínio.

## Como adicionar

- **JSON snapshots de respostas externas** (Apify, providers): arquivo
  `<source>/<nome>.json` capturado da API real, escrubado de PII.
- **Fixtures TS tipados** (objetos válidos para Zod schemas, builders): arquivo
  `<area>.ts` exportando constantes nomeadas + factory helpers tipados.
  Importar tipos via `@/types/...` ou `@/lib/...`.
- Não inclua dados pessoais reais. Use payloads sintéticos baseados no shape
  oficial.

## Regras

1. **Tipados quando possível.** Fixtures TS devem importar e anotar com o tipo
   do domínio (`SiteVariables`, `SiteCopy`, etc) — assim quebram em compile-time
   se o schema mudar.
2. **Reusabilidade > duplicação.** Se um payload é construído ad-hoc em ≥2
   testes diferentes, mover pra cá.
3. **Sem fetch real.** Tudo aqui é estático/sintético; nada que chame APIs.
4. **Sem segredos.** Tokens, emails reais, números de telefone reais — nunca.

## Arquivos

| Path | Propósito |
|---|---|
| `google-maps-place.json` | Resposta sintética do Apify Google Maps Scraper para validar o mapper `lib/apify/google-maps.ts`. |
| `instagram/` | Fixtures do Apify Instagram (perfil + posts). |
| `website-contact/` | Fixtures de scraping de website contact pages. |
| `site-variables.ts` | `validSiteVariablesFixture` (passa em `SiteVariables.parse()`) e `validSiteCopyFixture` (passa em `SiteCopySchema.parse()`) — reutilizados em `tests/unit/types/lead-site.test.ts`, nas issues #158 (generateCopy IA), #159 (orquestrador `generateLeadSite`) e #166 (helpers E2E `tests/e2e/sites/helpers.ts`). |
