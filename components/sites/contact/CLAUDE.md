# `components/sites/contact/` — Section da rota `/contato` (Phase 7)

## Propósito

Sub-componentes que compõem a página Contato do site público
(`/sites/<slug>/contato`) — issue #163, redesenhada em #230. Renderizam dados de contato
(WhatsApp, telefone, email, endereço, horário, sociais) e o
`<SiteForm variant="contact">` para captura de lead.

## Como adicionar

- 1 arquivo por seção, em PascalCase com prefixo `Contact` quando for
  page-level (`ContactSection.tsx`, `ContactDualPane.tsx`) ou nome de
  bloco explícito (`BusinessHours.tsx`, `WhatsAppDirectCard.tsx`).
- **Sempre Server Component.** `import "server-only";` na linha 1.
  `<SiteForm>` interno é Client (delegação client/server explícita).
- **Props com subset explícito** (`Pick<SiteVariables, ...>` mais
  `siteId`/`slug`).
- **Links externos** sempre com `target="_blank"` +
  `rel="noopener noreferrer"` (a11y + segurança contra reverse
  tabnabbing).
- **WhatsApp/tel** normalizam o input via `whatsapp.replace(/\D/g, '')`
  antes de compor `wa.me/<digits>` ou `tel:+<digits>`. Defesa contra
  espaços / parênteses / hífens persistidos no DB.
- **Skip campos opcionais** (`email`, `address_line`, `instagram_url`,
  etc.) quando `null` — defesa contra ícones/linhas mortas no UI.
  `hours` tem fallback `"Segunda a Sexta: 09h-18h | Sábado: 09h-13h"`.

## Regras de negócio

1. **WhatsApp link**: `https://wa.me/<digits-only>` (sem `+`).
   Telefone link: `tel:+<digits>` (com `+`). Fonte: spec §11 +
   AC3 da issue #163.
2. **Sociais omitidos individualmente** quando URL é `null` — alinhado
   com o padrão do `<SiteFooter>` (#161).
3. **`<h1>` único** na página: a section tem `<h1>` "Contato".
   Subseções usam `<h2>`.
4. **Inline `<SiteForm variant="contact">`** no rodapé da section.
   `siteId`/`slug` propagados pra Server Action `submitSiteForm`.
5. **Mapa estático é opcional (#230).** A rota monta `staticMapUrl` com
   `GOOGLE_MAPS_STATIC_API_KEY` quando presente. Sem chave, renderiza
   placeholder visual + link externo Google Maps com endereço textual.
   Lat/lng/placeId vêm de `leads.raw` best-effort; V2 tipa coordenadas.

## Arquivos

| Path | Propósito |
|---|---|
| `ContactSection.tsx` | Orquestrador da página Contato (#230; PaymentStrip removida em #295): `<ContactDualPane>`, sociais e `<SiteForm variant="contact">`. Recebe `staticMapUrl` opcional + `mapsHref` já resolvidos pela rota. |
| `ContactDualPane.tsx` | Layout dual-pane: copy/canais/horário/WhatsApp à esquerda e mapa estático/fallback à direita. Não busca dados; apenas renderiza props sanitizadas upstream. |
| `BusinessHours.tsx` | Bloco visual de horários. Consome `hours: string \| null`, split por `\n` ou `|`, fallback canônico V1. |
| `WhatsAppDirectCard.tsx` | Card de atendimento direto por WhatsApp usando `buildWhatsAppLink({ template: 'general', component: 'contact-section' })`. |

## Boundary client/server

```
ContactSection (server) ───┬─ ContactDualPane (server)
                           └─ delega ao <SiteForm> (client) ── react-hook-form
```

A section é puro Server Component; só `<SiteForm>` cruza pra cliente
(estado de form + Server Action chamada).

## Dependências

- `next/image`.
- `lucide-react@^1.14` (`Mail`, `MapPin`, `Clock`, `Phone`,
  `ExternalLink`, `MessageCircle`).
- `@/lib/sites/static-map` — builder server-side da URL Static Maps.
- `../social-icons` — `InstagramIcon`/`FacebookIcon`/`YoutubeIcon`/
  `WhatsappIcon` (lucide removeu por trademark).
- `../SiteForm` — Client Component reutilizado de #161.
- `@/types/lead-site.SiteVariables` — tipos do payload (subset via
  `Pick`).

## Quando atualizar este `CLAUDE.md`

- Nova section da Contato (mapa interativo, lista de filiais, etc.).
- Mudança no contrato de props.
- Novo canal de contato (`tiktok_url`, `linkedin_url`, etc.) que afete
  o componente.
