# `components/dashboard/` — Spec Técnica

## Propósito

Composições do dashboard autenticado: cards de métricas, contagem por estágio e
lista das últimas buscas.

## Arquivos

| Path | Tipo | Propósito |
|---|---|---|
| `dashboard-view.tsx` | Client | Busca `/api/dashboard`, mostra skeleton inicial e refaz fetch ao focar a janela |

## Regras de negócio

1. **Fetch client-side** em `/api/dashboard` para suportar skeleton inicial e
   atualização ao voltar o foco da janela.
2. **Sem lógica de query no componente.** Agregação vive em `lib/dashboard`.
3. **Tipos do cliente** devem vir de `@/lib/dashboard/types`, nunca de
   `summary.ts` (`server-only`).
4. Estado vazio de buscas recentes deve ser explícito; não deixar lista em branco.
5. Mensagens de erro/status vindas das buscas recentes podem ser longas; manter
   `break-words`/contenção para não criar overflow horizontal.
6. Quando a base ainda está vazia, exibir CTA "Faça sua primeira busca" para
   `/search`.

## Dependências

- `@/components/ui/{button,card,badge,skeleton}`
- `lucide-react`
- `@/lib/dashboard/types`
