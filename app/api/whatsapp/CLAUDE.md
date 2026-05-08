# `app/api/whatsapp/` — Spec Técnica

## Propósito

Route handlers REST do recurso WhatsApp (Phase 5). Conectam a UI ao Evolution API via `lib/evolution/*` com padrão idêntico ao `/api/leads/*`: auth Supabase, validação Zod, erros via `apiErrorResponse`.

## Como adicionar

- Sempre `await createServerSupabase()` + `auth.getUser()` no topo (401 se ausente).
- Erros não-esperados → `apiErrorResponse(error, { route, userId }, mensagemAmigavel)`.
- Validação de body via `@/lib/validators/whatsapp`.
- Para chamar o Evolution: `createEvolutionClient()` (lê env). Capture `EvolutionApiError` quando precisar mapear erro específico (ex: 401 Evolution → 502 nosso com mensagem "verifique EVOLUTION_API_KEY").
- TDD obrigatório: tests em `tests/unit/app/api/whatsapp/...`.

## Regras de negócio

1. **1 instância por usuário.** `whatsapp_instances` tem `unique(user_id)`. POST faz upsert seguro.
2. **Slug determinístico.** `evo_instance = user_${user.id.slice(0, 8)}` para ser estável e não vazar UUIDs inteiros no Evolution.
3. **Estado autoritativo no DB**, não no Evolution. UI lê `whatsapp_instances.status`. Webhook (`/api/whatsapp/webhook`) é quem promove para `connected`.
4. **DELETE é tolerante.** Se o Evolution responder 404 (instância já não existe), seguimos pra deletar a row local. Outros erros logamos `warn` mas ainda removemos local pra UI ficar consistente.
5. **Cache-Control no-store** em todas as respostas com QR — evita CDN/proxy guardar QRs antigos.

## Arquivos

| Path | Propósito |
|---|---|
| `instance/route.ts` | GET status, POST cria instância, DELETE desconecta |
| `instance/qr/route.ts` | GET consulta QR Code do Evolution e cacheia em DB |
| `send/route.ts` | POST envia mensagem 1-a-1 (auth + zod + rate-limit + delegação a `lib/evolution/send`) |

> Próximas issues vão somar:
> - `webhook/route.ts` (#98) — POST público com HMAC

## Dependências

- `@/lib/supabase/server`
- `@/lib/evolution/client`
- `@/lib/api/errors`
- `@/lib/env`

## Testes

- `tests/unit/app/api/whatsapp/...` — mock `lib/evolution/client` e Supabase via `vi.hoisted` + `vi.mock`.
- Cobrir: 401, 200 happy path, 502 erro Evolution, idempotência do POST.
