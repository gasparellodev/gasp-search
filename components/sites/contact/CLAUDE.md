# `components/sites/contact/` — Section da rota `/contato` (Phase 7)

## Propósito

Sub-componentes que compõem a página Contato do site público
(`/sites/<slug>/contato`) — issue #163. Renderizam dados de contato
(WhatsApp, telefone, email, endereço, horário, sociais) e o
`<SiteForm variant="contact">` para captura de lead.

## Como adicionar

- 1 arquivo por seção, em PascalCase com prefixo `Contact` (ex:
  `ContactSection.tsx`, `ContactMap.tsx` quando virem).
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
  `hours` tem fallback "Sob consulta".

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

## Arquivos

| Path | Propósito |
|---|---|
| `ContactSection.tsx` | Section principal: hero (image + h1 + canais + sociais) + form de captura. Recebe `Pick<SiteVariables, ...>` + `siteId` + `slug` + opcional `manifestContactUrl?: string \| null` (#217). Pattern de URL: `manifestContactUrl ?? variables.brand_assets.contact_image_url`. Caller (`/contato/page.tsx`) deriva via `site.visual_identity?.contact_url ?? null`. |

## Boundary client/server

```
ContactSection (server) ───┐
                           └─ delega ao <SiteForm> (client) ── react-hook-form
```

A section é puro Server Component; só `<SiteForm>` cruza pra cliente
(estado de form + Server Action chamada).

## Dependências

- `next/image`.
- `lucide-react@^1.14` (`Mail`, `MapPin`, `Clock`, `Phone`).
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
