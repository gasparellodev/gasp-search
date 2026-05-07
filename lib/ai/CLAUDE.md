# `lib/ai/` — Spec Técnica

## Propósito

Clientes e helpers server-only para recursos de IA. Hoje concentra o wrapper do Anthropic usado para gerar mensagens comerciais a partir de um lead.

## Como adicionar

- Todo arquivo que toca `ANTHROPIC_API_KEY` deve iniciar com `import "server-only"`.
- Use `env` de `@/lib/env` para modelo e credenciais; não leia `process.env` diretamente.
- Mocke `@anthropic-ai/sdk` nos testes. Nenhum teste deve chamar a API real.
- Preserve prompt caching no system prompt quando alterar o template.

## Regras de negócio

1. **Dados whitelisted.** Prompts para geração de mensagem usam apenas campos explícitos do lead; `raw`, `user_id` e metadados internos não entram no payload.
2. **Prompt de sistema cacheado.** O bloco de system prompt deve carregar `cache_control: { type: "ephemeral" }`.
3. **Saída simples.** `generateMessage()` retorna apenas texto final pronto para persistência/envio; sem markdown, alternativas ou metadados.
4. **Sem cache local de geração.** Mensagens IA são não determinísticas; persistência fica em `lead_messages` via API route futura.
5. **Histórico ordenado.** `listLeadMessages()` retorna mensagens do lead em `created_at desc`, paginadas em 20 itens.

## Arquivos

| Path | Propósito |
|---|---|
| `anthropic.ts` | Singleton Anthropic + `generateMessage(lead, { channel, tone, goal })` |
| `messages.ts` | Listagem paginada de `lead_messages` para histórico |

## Dependências

- `@anthropic-ai/sdk`
- `@/lib/env`
- `@/types/database`
