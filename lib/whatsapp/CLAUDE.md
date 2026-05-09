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

## Dependências

- Nenhuma externa. Helper puro.

## Testes

- `tests/unit/lib/whatsapp/templates.test.ts` — estrutura do template, render e-2-e contra o template real.
- `tests/unit/lib/whatsapp/render-template.test.ts` — happy path, multi-substitution, missing var, empty, `$1`/PT-BR/empty value, idempotência.

## Roadmap

- **#171 — `sendLeadSiteWhatsApp`**: vai consumir `SITE_PREVIEW_TEMPLATE` + `renderTemplate` para enviar a prévia gerada via Evolution.
- **V2** — per-user templates (DB), preview no UI, validação de placeholders desconhecidos antes do disparo.
