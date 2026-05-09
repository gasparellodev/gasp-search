# `lib/whatsapp/` — Spec Técnica

## Propósito

Templates e helpers de renderização para mensagens WhatsApp do fluxo **Site Generator (Phase 7)**. Hospeda apenas o que é específico desse domínio — o transporte (chamada à Evolution API) continua em `lib/evolution/`.

> Diferente de `lib/evolution/templates.ts` (campanhas, sintaxe `{{nome}}`, suporta placeholders desconhecidos sem lançar). Aqui o contrato é **estrito**: variável faltante é bug, não input do usuário.

## Como adicionar

- **Template novo**: declare como `export const X_TEMPLATE = "..."` em `templates.ts` e crie um array `as const` listando suas variáveis (ex: `TEMPLATE_VARIABLES`).
- **Helper de render novo**: arquivo dedicado em `render-*.ts`. Tudo puro, sem secrets, sem `server-only` (usado tanto server quanto client para preview).
- **Sempre** com testes em `tests/unit/lib/whatsapp/<file>.test.ts` (TDD, ≥ 5 cases por arquivo, cobrindo edge cases: missing var, empty, multi-substitution).

## Regras de negócio

1. **Sintaxe `{key}` (single-brace).** Single-brace, não double. `\w+` define a chave (letras, dígitos, `_`). Usar nomes `snake_case`.
2. **Lançar em variável faltante.** `renderTemplate` lança `Error('Missing template variable: <key>')`. Esse é o contrato V1: o caller (e.g., `sendLeadSiteWhatsApp` em #171) sempre conhece o conjunto declarado em `TEMPLATE_VARIABLES`.
3. **Valor vazio é válido.** `renderTemplate(t, { x: "" })` substitui por `""` sem lançar — útil pra opcionais.
4. **Sem persistência V1.** Templates são constantes exportadas. V2 follow-up: per-user customizable templates DB-backed.
5. **Não interpreta `$1` / `$&` em valores.** `renderTemplate` usa função de replacement, então URLs com `$` não viram patterns de `String.replace`.

## Arquivos

| Path | Propósito |
|---|---|
| `templates.ts` | `SITE_PREVIEW_TEMPLATE` (PT-BR, placeholders `{business_name}` e `{site_url}`) + `TEMPLATE_VARIABLES` (`as const`) + tipo `TemplateVariable`. |
| `render-template.ts` | `renderTemplate(template, vars)` — substitui `{key}` por `vars[key]`, lança em variável faltante. |
| `daily-limit.ts` | **Server-only.** `checkDailyInstanceLimit(userId, supabase)` + `DAILY_INSTANCE_LIMIT=50` (#173) — guard hard 50 envios/dia/instância (anti-ban WhatsApp). Conta `lead_messages` rows com `direction='outbound'` AND `created_at > now()-24h` AND `user_id = X`. **`whatsapp_instances` é 1:1 com `user_id`** (UNIQUE constraint na migration 0003), então contar por user é equivalente a contar por instância. **Janela rolling 24h** (não calendar day). **Boundary inclusive**: count >= 50 → bloqueado. **Fail-open** em erro de DB ou `count: null` (consistente com `enforceRateLimit` do `generateLeadSite`). Retorno discriminated union `{ allowed: true; current } \| { allowed: false; current; limit }`. |

## Contrato de `checkDailyInstanceLimit` (#173)

| Caso | Retorno |
|---|---|
| count = 0 | `{ allowed: true, current: 0 }` |
| count < 50 | `{ allowed: true, current }` |
| count = 50 | `{ allowed: false, current: 50, limit: 50 }` (boundary inclusive) |
| count > 50 | `{ allowed: false, current, limit: 50 }` |
| count = null | `{ allowed: true, current: 0 }` (fail-open) |
| Supabase error | `{ allowed: true, current: 0 }` (fail-open) |

**Aplicado em:**
- `app/actions/lead-site.ts > sendLeadSiteWhatsApp` (#171, #173) — após status guard, antes do render. Bloqueado → `error: 'rate_limit_daily'` + mensagem PT-BR.
- `lib/sites/dispatch-site-preview.ts` (#172, #173) — após status guard, antes do render. Bloqueado → `reason: 'rate_limit_daily'` + mensagem PT-BR.
- `lib/campaigns/processor.ts` (#172, #173) — `rate_limit_daily` → marca `campaign_targets.status='failed'` (não `'skipped'`). Decisão V1: operador precisa de awareness (retentar amanhã com consciência), não silently skip.

## Dependências

- `@supabase/supabase-js` — tipo `SupabaseClient<Database>` (DI).
- `@/types/database` — tipos do schema (lead_messages).

## Testes

- `tests/unit/lib/whatsapp/templates.test.ts` — estrutura do template, render e-2-e contra o template real.
- `tests/unit/lib/whatsapp/render-template.test.ts` — happy path, multi-substitution, missing var, empty, `$1`/PT-BR/empty value, idempotência.
- `tests/unit/lib/whatsapp/daily-limit.test.ts` — boundary cases (0/49/50/51), fail-open (null/error), query shape (table/eqs/gte janela 24h).

## Roadmap

- **V2** — per-instance limit configurável (alguns providers permitem mais que 50).
- **V2** — per-user templates (DB), preview no UI, validação de placeholders desconhecidos antes do disparo.
