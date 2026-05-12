# `lib/lgpd/` — Consentimento e auditoria LGPD

## Propósito

Helpers compartilhados para consentimento granular dos sites públicos
(`/sites/<slug>`): estado client-safe em `localStorage` e persistência
server-side de decisões em `consent_logs`.

## Arquivos

| Path | Propósito |
|---|---|
| `consent-state.ts` | Constantes e tipos client/server-safe para consentimento (`gasp_consent_v1`, versão `v1`, categorias `necessary`/`analytics`/`marketing`). Também valida o JSON persistido no browser. |
| `consent-audit.ts` | **Server-only.** `logConsent(input)` persiste decisões em `consent_logs` via service-role. Retorna `{ok:false}` em erro e só loga action/version/mensagem de infra, sem PII. |

## Regras

- `necessary` é sempre `true`; `analytics` e `marketing` são opt-in.
- Nunca importar `consent-audit.ts` em Client Components.
- Não logar IP/user-agent como observabilidade; eles só podem ser persistidos
  na tabela de auditoria.
