# `lib/analytics/` — telemetria client-side (#233)

## Propósito

- `track-event.ts`: dispara eventos GA4 via `gtag` **somente** com consentimento `analytics` ativo (lê `localStorage` + `parseConsentDecision`).
- Consumido por CTAs e forms dos sites públicos (`/sites/[slug]/*`).

## Regras

1. Nunca importar código `server-only` aqui.
2. `trackEvent` é best-effort: falhas não propagam ao usuário.
3. Novos eventos: estender `SiteTrackEventName` + documentar em `docs/ANALYTICS.md`.
