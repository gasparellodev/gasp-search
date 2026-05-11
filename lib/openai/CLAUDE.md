# `lib/openai/` — Spec Técnica

## Propósito

Adapter pattern para OpenAI APIs. Atualmente uma única integração:
**Images API** para geração de identidade visual AI (Phase 7 Sprint 2
#A2, issue #216).

Cliente é server-only via `import "server-only"`. `OPENAI_API_KEY`
jamais entra no bundle do cliente.

`OPENAI_API_KEY` é **opcional** no schema (`lib/env.ts`) para permitir
build em ambientes sem o secret (Vercel preview, CI sem secret).
Validação acontece lazy em `getOpenAIClient()`: throw eloquente só
quando algum code path tenta gerar imagem.

## Como adicionar

- Cada integração tem um arquivo dedicado (`image-client.ts`,
  futuramente `chat-client.ts` etc).
- **TDD obrigatório** — função pura ou adapter, sempre tests primeiro.
- **Erros tipados** — toda função exposta deve mapear erros do SDK
  pra classe própria com `code` + `retryable: boolean` (deixa decisão
  de retry pro caller).
- **NÃO** usar retry interno do SDK (`maxRetries: 0`) — caller decide
  via `error.retryable`.

## Regras de negócio

1. **Server-only.** Token de API jamais no bundle do client (defesa em
   profundidade via `import "server-only"`).
2. **Snapshot-pinned models.** Modelos são pinados via env
   (`OPENAI_IMAGE_MODEL` default `gpt-image-2-2026-04-21`) para
   reprodutibilidade. Mudanças requerem PR de spec.
3. **Pricing tables snapshot-locked.** `PRICING_USD` em `image-client.ts`
   é atualizado manualmente quando OpenAI muda pricing. Test garante
   valores conhecidos não-drift.
4. **NÃO passar `response_format`** em `images.generate` — gpt-image-2
   retorna 400. Spike documentado em
   `tmp/research/openai-image-spike.md`.
5. **NÃO ler `revised_prompt`** — campo é DALL-E 3 only.
6. **Fallback de size automático**: `1792x1024` → `1536x1024` em
   `invalid_size` (gpt-image-2 nem sempre aceita).
7. **DALL-E 3 não é fallback** — modelo deprecado 2026-05-12. Fallback
   é `gpt-image-1-mini` (responsabilidade do caller em
   `lib/sites/visual-identity.ts`).

## Arquivos

| Path | Propósito |
|---|---|
| `image-client.ts` | **Phase 7 #216.** Adapter para `OpenAI().images.generate(...)`. Exporta `generateImage({prompt, size, quality, model?})`: válida via Zod, chama API, mapeia erros do SDK pra `ImageGenerationError` tipado (`code: 'moderation_blocked' \| 'rate_limited' \| 'invalid_size' \| 'timeout' \| 'server_error' \| 'unknown'` + `retryable: boolean`). Fallback automático `1792x1024 → 1536x1024` em invalid_size. Singleton lazy (`getOpenAIClient`) com `maxRetries: 0` + `timeout: 120_000`. Exporta `PRICING_USD` snapshot-locked. |

## Dependências

- `openai` (npm) — SDK v6+ (suporta Zod v4 peer).
- `zod` — input validation (`GenerateImageInputSchema`).
- `@/lib/env` — `OPENAI_API_KEY` + `OPENAI_IMAGE_MODEL`.

## Quando atualizar este CLAUDE.md

- Nova integração OpenAI (chat, embeddings, etc.).
- Mudança em pricing table (manter snapshot test também).
- Novo erro code mapeado.
- Mudança em snapshot model padrão (env default).
