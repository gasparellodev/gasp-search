# `app/api/campaigns/` — Spec Técnica

## Propósito

CRUD + start de campanhas WhatsApp (Phase 5). Processor inline na rota POST.

## Arquivos

| Path | Propósito |
|---|---|
| `route.ts` | GET lista, POST cria (até 50 leads) + insere targets + roda `processCampaign` inline. `maxDuration=300`. |
| `[id]/route.ts` | GET detalhe + lista de targets. PATCH `{action:'cancel'}` marca cancelled. |

## Regras

- Auth obrigatória (401).
- Validação zod via `@/lib/validators/campaigns` (mín 1 / máx 50 leads, payload por modo).
- Antes de criar, valida que todos os `leadIds` pertencem ao user (via `select` na tabela `leads` — RLS já filtra; se a contagem não bater, é erro 422 — mensagem amigável).
- Processor: ver `lib/campaigns/processor.ts`. Cancelamento checado a cada iteração.
- Erros de I/O usam `apiErrorResponse(...)` com mensagem amigável.

## Limitações

- 50 leads por campanha (validador). Maior fica para Phase 5.5 (queues).
