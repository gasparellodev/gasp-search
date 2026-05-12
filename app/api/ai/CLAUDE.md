# `app/api/ai/` — Spec Técnica

## Propósito

Endpoints REST autenticados para recursos de IA. Toda chamada exige usuário Supabase e nunca expõe tokens Anthropic ao cliente.

## Endpoints

### `POST /api/ai/generate-message`

Valida `{ leadId, channel, tone, goal? }`, carrega o lead do usuário via RLS, chama `generateMessage()` e persiste o resultado em `lead_messages` como **draft** (`ai_generated: true`, `status: 'queued'`, `whatsapp_msg_id: null`). O draft só vira mensagem real ao passar pelo `/api/whatsapp/send` — que promove `status='sent'` e preenche `whatsapp_msg_id`. Inbox `/messages` filtra drafts via `direction.eq.inbound,whatsapp_msg_id.not.is.null`.

**Response:** `200 { content, messageId }`.

Erros:
- `400` body inválido
- `401` não autenticado
- `404` lead inexistente ou bloqueado por RLS
- `429` mais de uma chamada por segundo por usuário (header `Retry-After: 1`, body `{ error: "rate_limited" }`)
- `502` falha de geração ou persistência

## Regras de negócio

1. **Auth em todo handler** via `createServerSupabase().auth.getUser()`.
2. **RLS é a fonte de ownership.** Lead de outro usuário deve retornar `404`.
3. **Validação Zod antes de side effects** em Anthropic ou Supabase.
4. **Rate limit básico por usuário** em memória com TTL (#132). `Map<userId, { ts, expiresAt }>` é purgado on-access em cada chamada (entradas com `ts < now - RATE_LIMIT_MS * 10` são deletadas), evitando vazamento de memória em runtime longo. Resposta 429 inclui `Retry-After: 1` para padronizar com `/api/whatsapp/send`. **V2:** migrar para `ai_usage_counters` em Postgres (row por user com `last_ts`/`daily_count`) — corrige bypass em multi-instance/cold-start.
5. **Payload mínimo do lead.** A rota não seleciona `raw`, ids internos ou timestamps para geração.
6. Falhas de geração/persistência passam por `apiErrorResponse()` para log
   estruturado e resposta amigável sem stack.

## Dependências

- `@/lib/supabase/server`
- `@/lib/api/errors`
- `@/lib/ai/anthropic`
- `@/lib/validators/ai`
