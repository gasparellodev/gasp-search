# `public/` — Spec Técnica

## Propósito

Assets estáticos servidos diretamente pelo Next: favicon, ícones, logos, imagens OG, fontes locais (se houver).

## Como adicionar

- Coloque o arquivo em `public/<categoria>/<nome>.<ext>`.
- Acesse via path absoluto: `<img src="/logo.svg" />`.
- Para imagens otimizáveis, prefira `next/image` apontando para o arquivo público.

## Regras de negócio

1. **Nada de PII ou dado sensível** em `public/`. É servido sem auth a quem souber a URL.
2. **Tamanho**: prefira SVG/WebP/AVIF. Imagens raster > 200KB devem ser otimizadas (squoosh, sharp).
3. **Naming**: `kebab-case.ext`. Sem espaços.
4. **Versionar**: imagens entram no git. Para conteúdo gerado por usuário, use Vercel Blob ou Supabase Storage (issue futura).

## Arquivos

> Atualmente populado com defaults do create-next-app (next.svg, vercel.svg, file.svg, globe.svg, window.svg) — serão substituídos em #11 ou #34 (README).
