# `lib/stock/` — Helpers puros de estoque público

## Propósito

Lógica client-safe e server-safe para a listagem pública de veículos em
`/sites/[slug]/estoque`.

## Como adicionar

- Mantenha funções puras, sem `server-only`, filesystem, rede ou estado global.
- Testes ficam em `tests/unit/lib/stock/` e devem cobrir ordenação,
  paginação e edge cases de URL.
- Tipos de carro vêm de `@/types/lead-site`.

## Arquivos

| Path | Propósito |
|---|---|
| `sort.ts` | `sortCars`, `parseStockSortKey` e as 5 opções públicas de sort do estoque. |
| `pagination.ts` | `paginate` e `parseStockPage` para paginação por `?page=N`. |

## Quando atualizar

- Nova opção de ordenação pública.
- Mudança de semântica da paginação ou do tamanho de página padrão.
