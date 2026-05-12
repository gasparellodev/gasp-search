# `components/sites/advertise/` — Section da rota `/anunciar` (Phase 7)

## Propósito

Sub-componentes que compõem a página Anunciar do site público
(`/sites/<slug>/anunciar`) — issue #163. Permitem que um visitante
externo proponha vender um carro à concessionária. MVP V1: stub —
form valida via Zod, Server Action retorna `{ ok: true }` sem
persistir (tabela `lead_announcements` será criada em follow-up).

## Como adicionar

- 1 arquivo por seção, em PascalCase com prefixo `Advertise` /
  `Announce` (ex: `AdvertiseSection.tsx`, `AnnounceForm.tsx`).
- **Server Component por padrão.** `'use client'` apenas em
  componentes que precisam de estado de form / handlers de UI
  (`AnnounceForm.tsx`).
- **Server Components** começam com `import "server-only";`. **Client
  Components** começam com `"use client";` e nunca importam
  `server-only`.
- **Schema Zod** mora em `lib/sites/announcement.schema.ts` —
  compartilhado entre Client (`react-hook-form` + `zodResolver`) e
  Server Action (`submitAnnouncement`). Fonte única de verdade.
- **Cores via `style` inline + `sanitizeHex`** — `<AdvertiseSection>`
  sanitiza primary_color/text_on_primary antes de propagar pro
  `<AnnounceForm>` (Client). Defesa em profundidade.

## Regras de negócio

1. **Anti-XSS**: input do usuário **não é** renderizado de volta como
   HTML. Form values só viajam pro Server Action; nunca tocam DOM
   como markup. Sem `dangerouslySetInnerHTML`.
2. **LGPD obrigatório**: checkbox `lgpd_consent` é
   `z.literal(true)`. Submit bloqueado quando `false`. Link de
   privacidade aponta para `/sites/<slug>/lgpd` (#234).
3. **Stub V1**: `submitAnnouncement` valida e retorna `{ ok: true }`
   sem persistir. Quando a persistência chegar (tabela
   `lead_announcements`), preservar a discriminated union
   `{ ok: true } | { ok: false; error }` — front não muda.
4. **Padrão alinhado com SiteForm** (#161): mesma estrutura visual,
   mesma estratégia de erro (`role="alert"` + `aria-describedby`),
   mesmo toast `sonner` em sucesso e em falha server-side.
5. **`mensagem`** é opcional (não obrigatório). Quando ausente,
   payload chega sem o campo (Zod `optional()` sem default).

## Arquivos

| Path | Propósito |
|---|---|
| `AdvertiseSection.tsx` | **Server Component.** Wrapper com header (`<h1>` "Anuncie seu carro aqui" + descrição) + `<AnnounceForm>`. Sanitiza cores antes de propagar. |
| `AnnounceForm.tsx` | **Client Component.** `react-hook-form` + `zodResolver(AnnouncementSchema)`. Submit chama Server Action `submitAnnouncement`. LGPD checkbox obrigatório com link interno `/sites/<slug>/lgpd`. Toast `sonner` em sucesso/erro. |

## Boundary client/server

```
AdvertiseSection (server) ───┐
                             └─ delega ao <AnnounceForm /> (client) ── react-hook-form
                                  └─ chama submitAnnouncement (Server Action)
```

A section é Server Component; o form é Client por inteiro (precisa
de `useForm`). A Server Action `submitAnnouncement` é importada por
referência — borda explícita no import de `@/app/actions/site-announcement`.

## Dependências

- `react-hook-form@^7` + `@hookform/resolvers@^5`.
- `zod@^4` (schema em `lib/sites/announcement.schema.ts`).
- `sonner@^2` (toast).
- `lucide-react@^1.14` (`Loader2`).
- `next/link` — link da Política de Privacidade.
- `@/lib/sites/sanitize.sanitizeHex` — defesa em profundidade pra
  cores hex.
- `@/lib/sites/announcement.schema` — schema Zod compartilhado.
- `@/app/actions/site-announcement` — Server Action stub V1.

## Quando atualizar este `CLAUDE.md`

- Tabela `lead_announcements` chegar — atualizar a seção "Stub V1"
  com o caminho de persistência real.
- Novo campo no formulário (ex: `transmission`, `fuel`).
- Mudança no contrato da Server Action (shape de retorno).
