# `app/api/ai/` — Spec Técnica

## Propósito

Endpoints REST autenticados para recursos de IA. Toda chamada exige usuário Supabase e nunca expõe tokens Anthropic ao cliente.

## Endpoints

### `POST /api/ai/generate-message`

Valida `{ leadId, channel, tone, goal? }`, carrega o lead do usuário via RLS, chama `generateMessage()` e persiste o resultado em `lead_messages`.

**Response:** `200 { content, messageId }`.

Erros:
- `400` body inválido
- `401` não autenticado
- `404` lead inexistente ou bloqueado por RLS
- `429` mais de uma chamada por segundo por usuário
- `502` falha de geração ou persistência

## Regras de negócio

1. **Auth em todo handler** via `createServerSupabase().auth.getUser()`.
2. **RLS é a fonte de ownership.** Lead de outro usuário deve retornar `404`.
3. **Validação Zod antes de side effects** em Anthropic ou Supabase.
4. **Rate limit básico por usuário** em memória, suficiente para o MVP.
5. **Payload mínimo do lead.** A rota não seleciona `raw`, ids internos ou timestamps para geração.

## Dependências

- `@/lib/supabase/server`
- `@/lib/ai/anthropic`
- `@/lib/validators/ai`
