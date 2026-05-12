# `app/sites/[slug]/lgpd/` — Política LGPD pública

## Propósito

Rota pública `/sites/<slug>/lgpd` com template PT-BR de privacidade para cada
site de concessionária. Fecha o destino do link LGPD do footer e dos forms.

## Arquivos

| Path | Propósito |
|---|---|
| `page.tsx` | Server Component que reutiliza `getSite`, aplica o mesmo status routing das demais subrotas (`draft`/`archived` → 404), valida `variables` e renderiza a política dentro de `<SitePage>`. Metadata sempre `noindex`. |
| `template.md` | Fonte editorial do texto com placeholders `{business_name}` e `{contact_email}` para revisão jurídica/copy. |

## Regras

- Não expor conteúdo de site inválido, draft ou archived.
- Metadata da política permanece `noindex` mesmo quando o site tiver
  `signed_at`, porque é página jurídica auxiliar, não landing SEO.
- Sem logs de PII: em erro de parse, logar só `slug` e paths Zod.
