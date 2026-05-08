# `lib/evolution/` — Spec Técnica

## Propósito

Wrapper server-only para a [Evolution API](https://github.com/EvolutionAPI/evolution-api) (Phase 5). Encapsula chamadas REST e parser de webhook para isolar I/O do resto do código (handlers, tests, server actions).

## Como adicionar

- Tudo aqui é **server-only**: arquivos novos começam com `import "server-only"`.
- Use `env` de `@/lib/env` para credenciais — nunca `process.env.X` direto.
- Schemas de resposta do Evolution vivem em `@/lib/validators/whatsapp.ts` e usam `passthrough()` para tolerar campos extras.
- Tests obrigatórios com mock de `fetch` global (não chamar o Evolution real).

## Regras de negócio

1. **Erros tipados.** Todo erro de I/O com Evolution lança `EvolutionApiError` com `status` (HTTP) e `code` (string semântica). Handlers de API mapeiam para `apiErrorResponse(...)`.
2. **Status normalizados.** Evolution usa estados `open`/`close`/`connecting` etc. Convertemos para o enum interno `EvolutionStatus` (`disconnected`/`qr_pending`/`connecting`/`connected`/`error`) que casa com `whatsapp_status` do banco.
3. **Sem mutação global.** O cliente é criado por factory (`createEvolutionClient(opts)`) que aceita override de `baseUrl`, `apiKey` e `fetch` para testes. Não há singleton.
4. **Server-only.** A factory exige `EVOLUTION_API_KEY` presente; lança `EvolutionApiError` com code `EVOLUTION_API_KEY_MISSING` se ausente. Esta lib não pode ser importada por Client Components.

## Arquivos

| Path | Propósito |
|---|---|
| `client.ts` | Factory `createEvolutionClient()` + `EvolutionApiError` + funções `createInstance`/`getQRCode`/`sendText`/`getStatus`/`deleteInstance` |
| `templates.ts` | `renderTemplate(text, lead)` + `extractPlaceholders` + `validateTemplate` para campanhas modo `template`. Placeholders suportados: `nome`, `cidade`, `estado`, `categoria`, `rating`, `website`, `telefone` |
| `rate-limit.ts` | `checkRateLimit(userId, intervalMs)` — throttle in-memory por user. Default 3s. Bypass por campanha (que tem throttle próprio). |
| `send.ts` | `sendWhatsAppMessage({ supabase, userId, leadId, content, campaignId, aiGenerated })` — função pura reutilizada por `/api/whatsapp/send` e processor de campanha. Insere `lead_messages` queued, chama Evolution, atualiza pra sent/failed, promove `lead.stage` `new`→`contacted`. |
| `webhook.ts` | `verifyHmac(body, sig, secret)` (timing-safe), `parseWebhookPayload(json)` (union: messages.upsert / message.status / connection.update / unknown), `normalizePhone(raw)` (E.164 sem `+`). |

## Dependências

- `@/lib/env` (envs)
- `@/lib/validators/whatsapp` (schemas zod)
- API global `fetch` (Next.js / Node 24)

## Testes

- `tests/unit/lib/evolution/*.test.ts` — mock de `fetch` via factory injection ou `vi.spyOn(global, "fetch")`.
- Cobrir: 200 OK válido, 401 auth, 5xx, body malformado, network error.
