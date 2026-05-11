# `lib/og/` — Helpers de Open Graph

## Propósito

Helpers server-only usados por metadata files de Open Graph dos sites
públicos. Devem ser pequenos, testáveis isoladamente e compatíveis com
Edge runtime quando importados por `app/sites/[slug]/opengraph-image.tsx`.

## Como adicionar

- Exporte funções puras ou wrappers de I/O estreitos.
- Evite dependências Node-only se o helper for usado por metadata files
  com `runtime = "edge"`.
- Cubra com teste unitário em `tests/unit/lib/og/`.

## Regras de negócio

1. **Fallback graceful.** Falhas em assets de OG não podem derrubar a
   resposta; retorne `null` e deixe o caller cair para visual/fonte
   padrão.
2. **Sem fetch externo para fonte crítica.** `loadGeist()` lê
   `/fonts/geist-600.woff2` do próprio deployment (`VERCEL_URL` em preview,
   `NEXT_PUBLIC_APP_URL`/localhost como fallback); não depender de GitHub
   raw/CDN nem embutir o WOFF2 no Edge Function.
3. **Sem PII em logs.** Logs de fallback devem conter apenas status ou
   razão técnica curta.

## Arquivos

| Path | Propósito |
|---|---|
| `load-geist.ts` | Carrega Geist SemiBold 600 de `public/fonts` via URL pública do deployment, com timeout de 1s, memoização por isolate e fallback `null`. |
