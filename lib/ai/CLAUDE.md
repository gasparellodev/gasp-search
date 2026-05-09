# `lib/ai/` — Spec Técnica

## Propósito

Clientes e helpers server-only para recursos de IA. Hoje concentra o wrapper do Anthropic usado para gerar mensagens comerciais a partir de um lead.

## Como adicionar

- Todo arquivo que toca `ANTHROPIC_API_KEY` deve iniciar com `import "server-only"`.
- Use `env` de `@/lib/env` para modelo e credenciais; não leia `process.env` diretamente.
- Mocke `@anthropic-ai/sdk` nos testes. Nenhum teste deve chamar a API real.
- Preserve prompt caching no system prompt quando alterar o template.
- **Cliente compartilhado:** importe `anthropic` de `@/lib/ai/anthropic` em vez de instanciar `new Anthropic(...)` em outros módulos. Isso garante uma única instância por processo (compartilhada entre `generateMessage` e `generateCopy` da Phase 7).

## Regras de negócio

1. **Dados whitelisted.** Prompts para geração de mensagem usam apenas campos explícitos do lead; `raw`, `user_id` e metadados internos não entram no payload.
2. **Prompt de sistema cacheado.** O bloco de system prompt deve carregar `cache_control: { type: "ephemeral" }`.
3. **Saída simples.** `generateMessage()` retorna apenas texto final pronto para persistência/envio; sem markdown, alternativas ou metadados.
4. **Sem cache local de geração.** Mensagens IA são não determinísticas; persistência fica em `lead_messages` via API route futura.
5. **Histórico ordenado.** `listLeadMessages()` retorna mensagens do lead em `created_at desc`, paginadas em 20 itens.
6. **Schema estendido em Phase 5.** `lead_messages` ganhou colunas para conversas reais via Evolution: `direction` (`outbound`/`inbound`), `status` (`queued`/`sent`/`delivered`/`read`/`failed`), `whatsapp_msg_id` (UNIQUE para idempotência de webhook), `campaign_id` (FK pra `campaigns`), `error_message`, `ai_generated`. `listLeadMessages()` retorna todos esses campos via `LeadMessage` (Pick estendido).
7. **Filtro `realOnly` opcional.** `listLeadMessages()` aceita `realOnly?: boolean` (default `false`). Quando `true`, aplica `.or('direction.eq.inbound,whatsapp_msg_id.not.is.null')` — exclui drafts de IA que nunca foram transmitidos. Usado pelo `/api/messages` (chat real). Drawer "Mensagens IA" em `/leads/[id]` chama sem o filtro (intencional — é o histórico de drafts).

## Arquivos

| Path | Propósito |
|---|---|
| `anthropic.ts` | Cliente Anthropic compartilhado (named export `anthropic` + legado `getAnthropic()`) + `generateMessage(lead, { channel, tone, goal })` para outreach. O `anthropic` é um Proxy lazy: `new Anthropic(...)` só roda na primeira chamada efetiva, garantindo testes baratos. |
| `messages.ts` | Listagem paginada de `lead_messages` para histórico |

## Dependências

- `@anthropic-ai/sdk`
- `@/lib/env`
- `@/types/database`
