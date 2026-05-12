# `app/sites/[slug]/anunciar/` — rota Anunciar

## Propósito

Subrota pública `/sites/<slug>/anunciar` do Site Generator. Orquestra
dados server-side (`getSite`, status, `SiteVariables`, metadata/schema) e
renderiza a composição de anúncio em `components/sites/advertise/`.

## Regras locais

- `page.tsx` é Server Component e deve continuar com `import "server-only"`.
- Status `draft`/`archived`, site inexistente ou variables inválido sempre
  chamam `notFound()`.
- `?car_target_slug=` é best-effort: validar contra `variables.cars[]`;
  slug inválido/inexistente é ignorado silenciosamente, sem 404.
- Quando `car_target_slug` resolve, passar `targetCar` e `targetCarSlug`
  para `<AdvertiseSection>` e assinar o contexto com
  `createAnnouncementFormSignature`.
- Não ler fotos, arquivos ou bodies nesta rota; upload privado fica nas
  Server Actions em `app/actions/site-announcement.ts`.

## Arquivos

| Path | Propósito |
|---|---|
| `page.tsx` | Render principal da página Anunciar, metadata e BreadcrumbList. |
| `loading.tsx` | Skeleton da subrota. |
| `error.tsx` | Boundary client-side da subrota. |
