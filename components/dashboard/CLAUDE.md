# `components/dashboard/` — Spec Técnica

## Propósito

Composições do dashboard autenticado: cards de métricas, contagem por estágio e
lista das últimas buscas.

## Arquivos

| Path | Tipo | Propósito |
|---|---|---|
| `dashboard-view.tsx` | Client | Busca `/api/dashboard`, mostra skeleton inicial e refaz fetch ao focar a janela. Compõe métricas, breakdown por fonte, funil de conversão e últimas buscas. |
| `source-breakdown.tsx` | Client | Card com barras horizontais % por `LeadSource` + total + ganhos + taxa de conversão. Aceita `data: null` (skeleton) e `data: []` (empty state). #124 |
| `funnel.tsx` | Client | Card com bar chart de 5 estágios (`new → closed_won`) + drop rate entre etapas (vermelho quando encolhe, verde quando cresce). Aceita `data: null` (skeleton) e funil todo-zero (empty state). #124 |

## Regras de negócio

1. **Fetch client-side** em `/api/dashboard` para suportar skeleton inicial e
   atualização ao voltar o foco da janela.
2. **Sem lógica de query no componente.** Agregação vive em `lib/dashboard`.
3. **Tipos do cliente** devem vir de `@/lib/dashboard/types`, nunca de
   `summary.ts`/`insights.ts` (`server-only`).
4. Estado vazio de buscas recentes deve ser explícito; não deixar lista em branco.
5. Mensagens de erro/status vindas das buscas recentes podem ser longas; manter
   `break-words`/contenção para não criar overflow horizontal.
6. Quando a base ainda está vazia, exibir CTA "Faça sua primeira busca" para
   `/search`.
7. **Charts são primitivos (Tailwind + Radix-ish bars com `role="progressbar"`)** —
   sem dependência de Recharts. Mantém bundle leve e dark mode previsível via
   utilitários `bg-*-500 dark:bg-*-400`.
8. **`SourceBreakdown` e `Funnel` tratam o estado de loading com `data === null`**
   (skeleton interno) e o estado vazio renderizando uma mensagem inline em vez
   de barras. Skeleton com `data-testid` para asserts em testes.
9. Cores das barras vêm de mapas estáticos (`SOURCE_BAR_CLASS`, `STAGE_BAR_CLASS`)
   para garantir Tailwind detectar as classes no scan.

## Dependências

- `@/components/ui/{button,card,badge,skeleton}`
- `lucide-react`
- `@/lib/dashboard/types`
- `@/lib/leads/stage-presentation` (`STAGE_LABEL`)
