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
- **Dedup defensivo de `leadIds` antes de tudo (#129).** O backend aplica
  `[...new Set(parsed.data.leadIds)]` antes de validar e inserir. Razões:
  1. Payload `[leadA, leadA]` retornaria 1 row do Supabase mas teria
     `length=2`, rejeitando campanha legítima como cross-tenant.
  2. `campaign_targets` tem `primary key (campaign_id, lead_id)` (ver
     `supabase/migrations/0004_campaigns.sql`) — duplicatas no insert
     quebrariam a transação.
  3. Cada lead deve receber a campanha exatamente uma vez. `total_count`
     e o payload de `campaign_targets` precisam refletir o conjunto único.
- **Validação de posse com escopo `user_id` explícito (#129).** A query
  `select('id').in('id', ids).eq('user_id', user.id)` é defesa em
  profundidade. RLS já filtra, mas o `.eq` mantém isolamento mesmo se
  a policy for alterada/desabilitada por engano. Falha retorna 422 com
  mensagem amigável (não distinguimos "não existe" de "pertence a outro
  user" — evita leak de info entre tenants).
- Processor: ver `lib/campaigns/processor.ts`. Cancelamento checado a cada iteração.
- Erros de I/O usam `apiErrorResponse(...)` com mensagem amigável.

## Limitações

- 50 leads por campanha (validador). Maior fica para Phase 5.5 (queues).
