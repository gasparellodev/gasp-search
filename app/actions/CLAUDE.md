# `app/actions/` — Server Actions

## Propósito

Server Actions invocadas diretamente por Client Components, sem precisar
de uma rota REST dedicada em `app/api/`.

Diferente das API routes, Server Actions:
  - São tipadas estaticamente entre cliente e server.
  - Não exigem `fetch` no client — basta importar e chamar.
  - Não geram endpoint público GET-able.

Use Server Action quando a mutation:
  - É invocada por **um** componente específico do app (não API pública).
  - Não precisa de polling/webhook/batched ops.
  - Não vai ser consumida por integração externa.

Caso contrário, prefira API route REST em `app/api/`.

## Como adicionar

- 1 arquivo por ação (ou grupo coeso). Nome no formato `<recurso>.ts`,
  ex: `site-form.ts`.
- Primeira linha **DEVE** ser `'use server';` (caso contrário Next 16
  trata como código server normal e bloqueia chamada do client).
- Action é uma função `async` **exportada** com signature
  `(args...) => Promise<Result>`.
- Validação de input via Zod **obrigatória** — Server Actions são um
  endpoint público de fato (Next gera POST internamente).
- **Não retornar `Error`** — sempre `{ success: true, ... } |
  { success: false, error: string }`. Erros levantados são serializados
  pelo Next mas perdem stack útil em produção.
- **Sem PII em logs.** Mesmo que persistente, evite `console.log` de
  payloads que contêm email/telefone — defesa contra leak via
  observabilidade.

## Regras de negócio

1. **Auth via `createServerClient`** (de `@/lib/supabase/server`)
   quando a action depende de usuário autenticado. Para actions
   públicas (ex: `submitSiteForm`), não há sessão de usuário — usar
   `service-role` apenas para writes mínimas necessárias.
2. **Validação Zod antes de qualquer side effect.** Se `safeParse`
   falhar, retornar `{ success: false, error }` sem persistir.
3. **Nunca expor mensagens de erro do banco direto ao cliente.**
   Mapear para mensagens amigáveis em PT-BR.

## Arquivos

| Path | Propósito |
|---|---|
| `site-form.ts` | `submitSiteForm(siteId, payload)` — Server Action chamada pelo `<SiteForm>` público (#161). MVP: stub que valida via `SiteFormSchema` e retorna `{ success: true }`. Persistência em `site_form_submissions` é follow-up. |

## Dependências

- `zod` — schemas em `lib/...schema.ts`.
- `server-only` — implícito via `'use server'` do Next.

## Quando atualizar este `CLAUDE.md`

- Nova Server Action adicionada.
- Mudança em padrão de retorno (`Result` shape).
- Padrão novo de auth (ex: token-based) introduzido.
