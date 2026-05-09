# `public/assets/stock/` — Banco V1 de stock photos para sites de concessionária

## Propósito

Arquivos PNG dos 14 carros referenciados pelo manifest V1 em
`lib/sites/stock-photos.manifest.json`. Servidos pela rota estática
`/assets/stock/<file>.png` e consumidos pelo `pickCarStock` em
`lib/sites/stock-photos.ts` — que alimenta
`lead_sites.variables.car_placeholder_urls` no preview do site gerado
pela Phase 7.

## Status (V1)

- **PNG, dimensões livres.** Normalização para JPEG 1600×900 fica pra V2.
- **Sem `SOURCES.md` por imagem.** Atribuições reais ficam pra V2.
- **14 carros.** Distribuição mínima por categoria deferida pra V2 (hoje:
  5 esportivos, 3 SUVs, 2 picapes, 2 sedans).
- `sea-doo-stock.png` continua em disco mas NÃO está no manifest V1
  (jet ski não vai pra placeholder de concessionária de carros).

## Como adicionar uma foto V1

> Em V2 esta seção será substituída pelo workflow de curadoria definitivo.
> Enquanto isso, qualquer adição aqui precisa:

1. Salvar o arquivo como `public/assets/stock/<id>.png` (`<id>` em
   `kebab-case`, sem maiúsculas, dígitos e hífens).
2. Adicionar entrada em `lib/sites/stock-photos.manifest.json` com `id`,
   `category` (do enum `sedan|suv|picape|hatch|esportivo`), `condition`
   (`0km|seminovo`), `color` opcional, `url` (`/assets/stock/<id>.png`)
   e `alt` em PT-BR.
3. Atualizar `SOURCES.md` (mesma pasta).
4. Rodar `npm test -- tests/unit/lib/sites/stock-photos` — o teste de
   filesystem coverage falha automaticamente se manifest aponta pra
   arquivo inexistente.

## Regras de licenciamento

- V1: assets internos do design exploratório (CC0 uso interno) — ver
  `SOURCES.md`.
- V2: 100% das imagens com licença permissiva pra uso comercial
  (CC0/Unsplash License/Pexels License/foto própria). Atribuições
  obrigatórias serão renderizadas em footer ou metadata do site gerado.

## Dependências

- Lido por `lib/sites/stock-photos.ts` via URL pública servida por Next.js.
- Manifest em `lib/sites/stock-photos.manifest.json` (NÃO aqui — fica
  co-localizado com o helper que valida e consome).
