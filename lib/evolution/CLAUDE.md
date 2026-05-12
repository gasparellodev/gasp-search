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
5. **Slug de instância não-previsível (#130).** Novas instâncias usam `generateInstanceSlug()` (`nanoid(16)`, ~95 bits) e persistem em `whatsapp_instances.evo_instance_v2` (migration 0022). O slug antigo `user_<userId.slice(0,8)>` (32 bits) era enumerável via webhook público — o handler novo continua aceitando o legado durante o restart cycle do Evolution, mas writes só geram nanoids.

## Arquivos

| Path | Propósito |
|---|---|
| `client.ts` | Factory `createEvolutionClient()` + `EvolutionApiError` + funções `createInstance`/`getQRCode`/`sendText`/`getStatus`/`deleteInstance` |
| `phone.ts` | `normalizePhone(raw)` — **canonical** E.164 sem `+`, range fechado **8–15 dígitos** (#138a). Reusado por `send.ts` e `webhook.ts` para evitar critério divergente. |
| `templates.ts` | `renderTemplate(text, lead)` + `validateTemplate` para campanhas modo `template`. Placeholders suportados: `nome`, `cidade`, `estado`, `categoria`, `rating`, `website`, `telefone`. `extractPlaceholders` é private (interno só ao `validateTemplate`) desde #138a — não tinha importer externo. |
| `rate-limit.ts` | `checkRateLimit(userId, intervalMs)` — throttle in-memory por user. Default `EVOLUTION_DEFAULT_THROTTLE_MS` (3s, **canonical** desde #138a — reusado pelo `processCampaign`). Bypass por campanha (que tem throttle próprio). |
| `send.ts` | `sendWhatsAppMessage({ supabase, userId, leadId, content, campaignId, aiGenerated })` — função pura reutilizada por `/api/whatsapp/send` e processor de campanha. Insere `lead_messages` queued, chama Evolution, atualiza pra sent/failed, promove `lead.stage` `new`→`contacted` no primeiro outbound. Demais stages (`contacted`+) mantêm — só `new` é promovido (#138d, dead branch removido). |
| `webhook.ts` | `verifyHmac(body, sig, secret)` (timing-safe), `parseWebhookPayload(json)` (union: messages.upsert / message.status / connection.update / presence.update / unknown — variante unknown agora carrega `instance: string \| null` para o lookup anti-leak HMAC), `extractInstanceFromRoot(json)` (extrai nome da instância do envelope cru, usado pelo route handler pra autenticar até payloads `unknown` #130), `generateInstanceSlug()` (`nanoid(16)` URL-safe — gerador do `evo_instance_v2` #130). `presence.update` normaliza `composing`→`typing`, `paused`, `available`→`online`, `unavailable`→`offline` e extrai phone de JID. Reexporta `normalizePhone` de `./phone` para compat (importers do route handler e tests legados). |

## Dependências

- `@/lib/env` (envs)
- `@/lib/validators/whatsapp` (schemas zod)
- `nanoid@^5` — `generateInstanceSlug()` em `webhook.ts` (#130).
- API global `fetch` (Next.js / Node 24)

## Testes

- `tests/unit/lib/evolution/*.test.ts` — mock de `fetch` via factory injection ou `vi.spyOn(global, "fetch")`.
- Cobrir: 200 OK válido, 401 auth, 5xx, body malformado, network error.
