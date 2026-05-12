# `components/sites/advertise/` — Section da rota `/anunciar` (Phase 7)

## Propósito

Sub-componentes que compõem a página Anunciar do site público
(`/sites/<slug>/anunciar`) — issue #163, redesenhada em #231. Permitem
que um visitante externo proponha vender um carro à concessionária via
stepper de 4 passos com upload privado de fotos.

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
3. **Stepper #231**: ordem fixa Carro → Proprietário → Fotos →
   Revisão+LGPD. Avanço valida o step atual; Step Fotos exige 2 a 8
   fotos e renderiza o aviso "Borre a placa antes de enviar" no topo.
4. **Upload LGPD-safe**: fotos são comprimidas no client via
   `browser-image-compression` (`maxWidthOrHeight: 1920`, `maxSizeMB: 5`,
   `useWebWorker: true`), depois sobem via `requestUploadUrl` para o
   bucket privado `tradein-photos`. Server Action valida extensão, MIME,
   tamanho e magic bytes antes de assinar o upload.
5. **Anti-bot/CSRF**: honeypot `_hp_company`; `submitAnnouncement`
   valida same-origin e assinatura de contexto quando
   `SITE_FORM_HMAC_SECRET` está configurado. Rate limit V1 é Map
   in-memory de 3 submits/hora/IP.
6. **Persistência**: `submitAnnouncement` grava em
   `lead_form_submissions` e audita consentimento em `consent_logs`
   (`version='tradein_submission_v1'`, `categories.purpose` e
   `categories.lead_id`). Não criar migration local nesta pasta.
7. **`car_target_slug`**: rota `/anunciar?car_target_slug=...` valida o
   slug contra `cars[]`; se inválido, ignora silenciosamente. Quando
   válido, hero mostra o banner contextual e a action registra o alvo na
   mensagem persistida.
8. **Padrão alinhado com SiteForm** (#161): mesma estrutura visual,
   mesma estratégia de erro (`role="alert"` + `aria-describedby`),
   mesmo toast `sonner` em sucesso e em falha server-side.
9. **`mensagem`** é opcional (não obrigatório). Quando ausente,
   payload chega sem o campo (Zod `optional()` sem default).

## Arquivos

| Path | Propósito |
|---|---|
| `AdvertiseSection.tsx` | **Server Component.** Wrapper da página: `<AnnounceHero>`, `<AnnounceForm>` e `<AnnounceProcessExplanation>`. Sanitiza cores antes de propagar. |
| `AnnounceHero.tsx` | **Server Component.** Hero editorial com h1 "Anuncie seu carro aqui" e banner opcional de carro alvo (`targetCar`). |
| `AnnounceForm.tsx` | **Client Component.** Stepper 4 passos com `react-hook-form` + `zodResolver(AnnouncementSchema)`, compressão client-side de fotos, chamada a `submitAnnouncement` e uploads via `requestUploadUrl`. LGPD checkbox obrigatório com link interno `/sites/<slug>/lgpd`. Toast `sonner` em sucesso/erro. |
| `AnnounceProcessExplanation.tsx` | **Server Component.** Três cards explicando avaliação: envio de dados, fotos e retorno da loja. |

## Boundary client/server

```
AdvertiseSection (server) ───┐
                             └─ delega ao <AnnounceForm /> (client) ── react-hook-form
                                  ├─ chama submitAnnouncement (Server Action)
                                  └─ chama requestUploadUrl (Server Action)
```

A section é Server Component; o form é Client por inteiro (precisa
de `useForm`). A Server Action `submitAnnouncement` é importada por
referência — borda explícita no import de `@/app/actions/site-announcement`.

## Dependências

- `react-hook-form@^7` + `@hookform/resolvers@^5`.
- `zod@^4` (schema em `lib/sites/announcement.schema.ts`).
- `browser-image-compression` — compressão client-side antes de upload.
- `sonner@^2` (toast).
- `lucide-react@^1.14` (`Loader2`, warning e ícones dos cards).
- `next/link` — link da Política de Privacidade.
- `@/lib/sites/sanitize.sanitizeHex` — defesa em profundidade pra
  cores hex.
- `@/lib/sites/announcement.schema` — schema Zod compartilhado.
- `@/app/actions/site-announcement` — Server Actions de submit e upload.

## Quando atualizar este `CLAUDE.md`

- Se `lead_form_submissions` ganhar colunas específicas para fotos ou
  trade-in, atualizar a seção de persistência real.
- Novo campo no formulário (ex: `transmission`, `fuel`).
- Mudança no contrato da Server Action (shape de retorno).
