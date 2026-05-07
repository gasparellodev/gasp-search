# `lib/apify/` — Spec Técnica

## Propósito

Integração com Apify (scraping). Cliente singleton + util `runAndPersist` que padroniza o fluxo de `validate → run → map → upsert` para qualquer fonte (Google Maps, Instagram, Website Contact).

## Como adicionar

### Nova fonte de dados

1. Definir input shape e zod schema em `lib/validators/search.ts`.
2. Criar `lib/apify/<source>.ts` com:
   - `<Source>Input` interface (shape exato do actor).
   - `<source>Mapper(item, ctx)` puro (testável sem Apify mockado).
3. Adicionar entry em `Enums<"search_source">` (já cobre google_maps/instagram/website_contact).
4. Criar API handler `app/api/apify/<source>/route.ts` que:
   - Valida body via zod.
   - Pega `userId` da sessão.
   - Chama `runAndPersist({ source, actorId, input, mapper, ... })`.
   - Retorna `{ jobId, status, leadsCount }`.

### Mapper — convenções

- **Puro**: sem side effects. Recebe `item` cru e `ctx` (userId, jobId, source). Retorna `LeadInsert | null`.
- **Null = filter out**: itens irrelevantes retornam null (não viram lead).
- **Normalização**:
  - `website`: `lower()` + remove protocolo + remove trailing slash + remove tracking params.
  - `instagram_handle`: lower + remove `@`.
  - `phone`/`whatsapp`: dígitos apenas (E.164 quando possível).
- **Dedup**: respeitar unique partial indexes em `leads`. Mapper não decide dedup — `runAndPersist` faz upsert com `onConflict`.
- **Raw payload**: incluir o item cru em `raw` para debug/re-processamento.

## Regras de negócio

1. **Apify síncrono**. `apify.actor(id).call(input)` aguarda finalização. Para inputs grandes (100s de leads), pode estourar timeout default de 60s do Vercel — handlers devem setar `export const maxDuration = 300` (Fluid Compute permite 300s).
2. **search_jobs é fonte da verdade do histórico**. Toda execução cria 1 row. Status: `queued → running → succeeded | failed`.
3. **Falha do actor não derruba o request**. `runAndPersist` marca `failed` e relança; o handler converte em response 502 amigável.
4. **Token nunca chega ao cliente**. `client.ts` importa `server-only`. Cliente singleton inicializado lazy (cold start friendly).
5. **Dataset listItems** retorna `{ items, count }`. Para inputs com paginação interna, items vêm já agregados.
6. **Webhook callback (V2)**: para inputs > 5min, migrar para `actor.start()` + cron polling em `search_jobs.status = 'running'`. Não no MVP.

## Arquivos

| Path | Propósito |
|---|---|
| `client.ts` | Singleton lazy do `ApifyClient` com `APIFY_TOKEN` |
| `run-and-persist.ts` | Função genérica `runAndPersist({ source, mapper, ... })` que orquestra job + run + upsert |
| `google-maps.ts` | Mapper `mapGoogleMapsPlace` + `normalizeWebsite` |
| `instagram.ts` | Mapper `mapInstagramProfile` + `normalizeInstagramHandle` |
| `enrich.ts` | `mapWebsiteContact` (puro) + `enrichLeadsByUrls` (orquestração) — atualiza leads existentes por URL, **não cria novos** |

## Dependências

- `apify-client`
- `@supabase/supabase-js` (peer types)
- `@/lib/env`, `@/types/database`

## Testes

- Mocke `apify-client` via `vi.mock("apify-client", ...)`.
- Mocke o Supabase client com objeto fake que rastreia `from()`/`insert()`/`update()`/`upsert()`.
- TDD: cobrir success, falha do actor, falha do upsert, dataset vazio, mapper que retorna null.
- Coverage atual: 100% lines/functions em `run-and-persist.ts`.

## Quando atualizar este `CLAUDE.md`

- Nova fonte (source) adicionada.
- Mudança no contrato `MapperContext` ou `LeadInsert`.
- Migração para mode async (`start()` + polling).
