# `lib/hooks/` — Hooks client compartilhados

## Propósito

Hooks React reutilizáveis por Client Components. Esta pasta é safe para
bundle client: não importa `server-only`, Supabase service-role, envs
privadas ou helpers que leem secrets.

## Como adicionar

- Arquivos que usam hooks React devem começar com `"use client"`.
- Preferir `useSyncExternalStore` para estado derivado de browser APIs que
  precisa ser SSR-safe, especialmente quando o lint bloquear
  `setState` síncrono em `useEffect`.
- Hooks devem receber dados serializados do Server Component quando a rota já
  resolveu o contexto server-side. Evitar fetch client-side duplicado para
  dados que já vieram de `lead_sites`.

## Arquivos

| Path | Propósito |
|---|---|
| `use-floating-cta-visibility.ts` | Observa `body[data-modal-open]` via `MutationObserver` e retorna se CTAs flutuantes podem renderizar. |
| `use-car-context.ts` | Normaliza o contexto serializado do carro no detalhe público: labels de preço/parcela e link WhatsApp `vehicle`. |
| `use-consent.ts` | Hook SSR-safe para consentimento granular LGPD. Exporta `useConsent(category)` para `analytics`/`marketing` e `useConsentDecision()` para o banner. Usa `localStorage` key `gasp_consent_v1`, evento `storage` e evento custom `gasp-consent-change` para updates no mesmo tab. |

## Dependências

- `react` (`useMemo`, `useSyncExternalStore`)
- `@/lib/finance`
- `@/lib/whatsapp`
- `@/types/lead-site`

## Quando atualizar este `CLAUDE.md`

- Novo hook for adicionado.
- Algum hook passar a depender de browser API nova, fetch client-side, ou
  contrato serializado diferente.
