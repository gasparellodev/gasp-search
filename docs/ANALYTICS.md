# Analytics — sites públicos (#233)

## Variáveis

| Variável | Onde | Notas |
|---|---|---|
| `NEXT_PUBLIC_GA4_ID` | build + runtime | Measurement ID (`G-XXXXXXXX`). Opcional — sem valor, GA4 não carrega. |
| `NEXT_PUBLIC_GSC_VERIFICATION` | build + runtime | Token da meta Google Search Console. Opcional. |

Ambas são validadas em `lib/env-public.ts` (opcionais). GA4 só injeta após opt-in de **analytics** no `<CookieBanner>` (`useConsent('analytics')`).

## Eventos custom (`trackEvent`)

Implementação: `lib/analytics/track-event.ts`. Eventos: `whatsapp_click`, `form_submit`, `phone_click`, `tradein_submit`, `financing_calc`, `car_detail_view`. Parâmetros são strings/números simples (GA4 data layer).

## Vercel Analytics

`<Analytics />` de `@vercel/analytics/react` em `components/sites/SitesAnalytics.tsx` — sem gating de cookies (server-side / privacy-friendly conforme fornecedor).

## Filtros GA4

Sugestão: criar vista filtrada por caminho contendo `/sites/` para isolar conversões dos mini-sites.
