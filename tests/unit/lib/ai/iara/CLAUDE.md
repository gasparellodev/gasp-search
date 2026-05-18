# `tests/unit/lib/ai/iara/` — Spec Técnica

## Propósito

Testes unitários do agente Iara — system prompt, memória (Supabase),
tool handlers.

## Como adicionar

- Espelhe o caminho de `lib/ai/iara/`. Cada arquivo recebe um spec.
- Use `createMockSupabaseClient` de `@/tests/__mocks__/supabase`
  para mockar service-role; não tente injetar client real.
- Convenção `vi.hoisted` para `supabaseHolder.client` permite
  reatribuir o mock por test (necessário porque `tables` overrides
  ficam no escopo do client).
- Para qualquer mudança no `IARA_TOOLS` schema do `system-prompt.ts`,
  atualizar `system-prompt.test.ts` (defende contagem + nomes).

## Regras

1. **Sem chamada real ao Anthropic.** Mocks via
   `@/tests/__mocks__/anthropic` quando relevante.
2. **Sem rede / sem banco.** Tudo mockado.
3. **Determinismo**: handlers que tocam `new Date()` (e.g.,
   `agendar_followup`, `marcar_lead_morto`) testam apenas o shape
   (ISO string) — não comparam contra valores absolutos.

## Arquivos

| Path | Propósito |
|---|---|
| `system-prompt.test.ts` | Defende interpolação de `founder_name`, presença de seções críticas (LIMITES DUROS, GEOGRAFIA, SITE ATUAL), schema das 6 tools, versão. |
| `memory.test.ts` | Testa `getOrCreateConversation` (idempotência), `appendMessage` (insert + bump), `loadHistory` (order ASC + tool_calls narrowing), `recordHandoff`. |
| `tools.test.ts` | Cobre os 6 handlers: happy path, sandbox fallback (lead inexistente), normalização de input inválido, propagação de erro do Supabase, persistência correta de FKs. |
