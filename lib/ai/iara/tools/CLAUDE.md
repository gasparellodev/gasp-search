# `lib/ai/iara/tools/` — Spec Técnica

## Propósito

Handlers das 6 tools da Iara (formato Anthropic `tool_use` / `tool_result`).
Cada handler recebe `(input, ctx)` e retorna o `content` do `tool_result`
block (JSON serializável). Schema das tools fica em
`lib/ai/iara/system-prompt.ts:IARA_TOOLS`; aqui mora apenas a execução.

## Como adicionar

- Toda tool nova exige: (1) entry em `IARA_TOOLS` em `system-prompt.ts`,
  (2) handler aqui, (3) referência no system prompt textual (seção
  FERRAMENTAS DISPONÍVEIS), (4) teste unitário em
  `tests/unit/lib/ai/iara/tools.test.ts`.
- Handler precisa ser **idempotente o quanto possível** — Anthropic
  pode chamar a mesma tool duas vezes em sequência se o cliente repete
  intenção; preferimos não duplicar handoffs/followups idênticos. (Por
  enquanto não dedupamos; Fase 2 adiciona uniqueness no banco se virar
  problema real.)
- Toda escrita deve passar `user_id = ctx.userId` para simular RLS
  (este módulo usa service-role).

## Regras de negócio

1. **Sandbox-friendly**: handlers que dependem de dados externos (Asaas,
   estoque, etc.) retornam stubs realistas em Fase 1. Fase 2 substitui.
2. **Defensive narrowing**: o `input` é `unknown` por contrato — não
   confiar no shape. Helpers locais `asString` / `asRecord` aplicam
   narrowing defensivo. O schema do Anthropic já filtra na origem,
   mas defesa em profundidade vale.
3. **Erros viram tool_result com `is_error: true` no caller** (no
   endpoint da API). Handler só lança quando há erro estrutural
   (DB/network); o endpoint converte em tool_result de erro.
4. **`marcar_lead_morto` preserva `notes`**: concatena em vez de
   sobrescrever. Audit trail importa.

## Arquivos

| Path | Propósito |
|---|---|
| `index.ts` | Exporta `IARA_TOOL_HANDLERS` (record de 6 handlers indexado por nome) + `isIaraToolName` (type guard). |

## Dependências

- `@/lib/supabase/service` (service-role; bypassa RLS)
- `@/lib/ai/iara/memory` (`recordHandoff` reusa o módulo de memória)
- `@/lib/ai/iara/system-prompt` (`IaraToolName` para typing)
