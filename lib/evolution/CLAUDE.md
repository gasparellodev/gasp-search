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

> Próximas issues vão somar:
> - `templates.ts` (#94) — render de placeholders {{nome}}, {{cidade}}, etc.
> - `webhook.ts` (#98) — parser de payloads inbound + verify HMAC
> - `rate-limit.ts` (#97) — throttle in-memory por usuário
> - `send.ts` (#101) — função pura de envio reutilizada por send 1-a-1 e processor de campanha

## Dependências

- `@/lib/env` (envs)
- `@/lib/validators/whatsapp` (schemas zod)
- API global `fetch` (Next.js / Node 24)

## Testes

- `tests/unit/lib/evolution/*.test.ts` — mock de `fetch` via factory injection ou `vi.spyOn(global, "fetch")`.
- Cobrir: 200 OK válido, 401 auth, 5xx, body malformado, network error.
