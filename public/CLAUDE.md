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
5. **Assets de bancos/pagamento (#219).** `public/assets/banks/*.svg` e
   `public/assets/payment/*.svg` são ícones monocromáticos cinza
   produzidos para UI, não arquivos oficiais das marcas. Cada SVG deve
   declarar `width`, `height` e `viewBox`, ter viewBox mínimo 32×32 e não
   usar `<style>` inline para permanecer CSP-friendly. Logos e marcas
   nominativas pertencem aos respectivos titulares (Santander, Bradesco,
   Itaú, BV, Banco PAN, Caixa, Porto e demais métodos/serviços).

## Arquivos

| Path | Propósito |
|---|---|
| `assets/banks/` | SVGs monocromáticos 40×40 usados pelo `BanksStrip` dos sites públicos. |
| `assets/payment/` | SVGs monocromáticos 40×40 usados pelo `PaymentStrip` dos sites públicos. |
| `assets/{about,contact,emphasis,hero,logos,sale,stock,sw4-details}/` | Assets estáticos do site demo/concessionária usados pelas rotas públicas. |
| `fonts/geist-600.woff2` | Geist SemiBold 600 local usado pelo OG image dinâmico dos sites públicos; evita dependência de GitHub raw/CDN em social preview. |
| `<INDEXNOW_KEY>.txt` | **Manual, não gerado neste PR.** Arquivo de verificação IndexNow (#232): quando `INDEXNOW_KEY` for configurada em produção, publicar `public/<INDEXNOW_KEY>.txt` contendo exatamente a key. |
| `*.svg` raiz | Defaults do create-next-app mantidos enquanto ainda referenciados pelo app/template. |
