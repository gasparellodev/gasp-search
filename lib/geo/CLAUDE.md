# `lib/geo/` — GEO/AI Monitoring Helpers (Phase 7 / Frente 04)

## Propósito

Helpers server-only para **Generative Engine Optimization (GEO)**: monitoramento
de menções de marca em plataformas de AI search (Perplexity, ChatGPT, Google AI
Overviews). Complementa a camada de indexação (`lib/seo/`) com dados de *brand
citation* — responde "os sites gerados estão sendo citados por LLMs?".

## Como adicionar

- **Novo provider** (ex: `PerplexityProvider`, `DataForSEOProvider`): implementar
  `interface MonitoringProvider` de `monitoring/provider.ts`. Passar via DI ao
  script orquestrador em `scripts/geo-monitoring/run.ts` (substitua
  `MockMonitoringProvider` quando API keys estiverem configuradas).
- **Nova métrica de reporte**: estender `ReportEntry` e `renderReport` em
  `monitoring/report.ts`.
- **Novos padrões de query**: editar `monitoring/queries.ts`. O contrato é:
  `buildAmostralQueries(variables): string[]` — sempre ≤ 5, nunca lança.
- Testes ficam em `tests/unit/lib/geo/monitoring/`.

## Regras

- **Server-only** — todo arquivo importa `"server-only"`. Nunca expor no bundle
  do cliente.
- **Sem PII nos logs.** URLs públicas dos mini-sites são permitidas; campos
  internos como `variables.email`, `variables.phone` não.
- **Falhas de provider degradam com `console.warn`**, nunca bloqueiam o fluxo
  do script.
- **MockMonitoringProvider é o default V1.** Nunca fazer deploy de um provider
  real sem API key validada em `lib/env.ts` + secret configurado no Vercel.

## Arquivos

| Path | Propósito |
|---|---|
| `monitoring/provider.ts` | `interface MonitoringProvider` + `MonitoringResult` + `MonitoringSource` type. `MockMonitoringProvider` é o default V1 — retorna `cited: false` + `console.warn`. Futuros: `PerplexityProvider`, `ChatGPTScraperProvider`. |
| `monitoring/queries.ts` | `buildAmostralQueries(variables: SiteVariablesV2): string[]` — gera até 5 queries naturais (nome do negócio, cidade, marcas × cidade, fallback genérico). Nunca lança. |
| `monitoring/report.ts` | `renderReport(entries: ReportEntry[]): string` — relatório markdown agrupado por `lead_site_id` com contagem de menções, tabela de queries e truncagem de snippets em 80 chars. |

## Script orquestrador

`scripts/geo-monitoring/run.ts` — executado via `npm run geo:monitor`:
1. Carrega `lead_sites` com `status IN ('published','sent') AND signed_at IS NOT NULL` via `createServiceSupabase()` (bypassa RLS — tabela operacional).
2. Para cada site: `buildAmostralQueries(variables)` → `provider.check(query, domain)`.
3. Persiste em `lead_sites_geo_monitoring` (migration 0024).
4. Escreve relatório em `docs/geo-monitoring/YYYY-MM-DD-report.md`.

**NÃO rodar em CI** — escreve no DB real e consome APIs externas.

## Tabela DB

`lead_sites_geo_monitoring` (migration 0024):
- `source` check: `'perplexity' | 'chatgpt' | 'mock'`
- RLS: `service_role` only
- Index: `(lead_site_id, checked_at desc)` para histórico por site

## Dependências

- `@supabase/supabase-js` — via `createServiceSupabase()` (DI implícita)
- `@/lib/sites/migrate-variables` — `readSiteVariablesSafe()` para parse defensivo
- `@/types/lead-site` — `SiteVariablesV2`
- `dotenv` — carregado no topo do script antes de qualquer import de `lib/`

## V2 roadmap

- Substituir `MockMonitoringProvider` por `PerplexityProvider` quando `PERPLEXITY_API_KEY` for configurada.
- `DataForSEOProvider` via REST direto (sem MCP — script roda offline).
- Adicionar `cited_url` à `MonitoringResult` para rastrear qual URL foi citada.
- Dashboard UI que lê `lead_sites_geo_monitoring` (leitura via server-role token em rota autenticada).
