# Stock photos — V1 (placeholder)

## Status

V1 do banco de stock photos para o gerador de sites de concessionária
(Phase 7, M1.3 / issue #157). Usa assets internos pré-existentes do
design exploratório (Touring Cars). Curadoria final (≥30 carros, JPEG
1600×900, atribuições reais com URL fonte e autor) está deferida pra
issue follow-up V2.

## Manifest

O manifest canônico vive co-localizado em
`lib/sites/stock-photos.manifest.json` (importado via `import` JSON e
validado por Zod no boot). Esta pasta serve apenas os arquivos PNG via
rota estática `/assets/stock/<file>.png`.

## Tabela de licenciamento — V1

| id                    | source              | autor              | licença              | atribuição_obrigatória | texto_atribuição |
| --------------------- | ------------------- | ------------------ | -------------------- | ----------------------- | ----------------- |
| bmw-m2                | Internal placeholder | gasparellodev/team | CC0 (uso interno)    | não                     | —                 |
| range-rover           | Internal placeholder | gasparellodev/team | CC0 (uso interno)    | não                     | —                 |
| ram-1500              | Internal placeholder | gasparellodev/team | CC0 (uso interno)    | não                     | —                 |
| audi-rs6              | Internal placeholder | gasparellodev/team | CC0 (uso interno)    | não                     | —                 |
| toyota-sw4            | Internal placeholder | gasparellodev/team | CC0 (uso interno)    | não                     | —                 |
| ford-mustang          | Internal placeholder | gasparellodev/team | CC0 (uso interno)    | não                     | —                 |
| ford-raptor           | Internal placeholder | gasparellodev/team | CC0 (uso interno)    | não                     | —                 |
| porsche-gt3           | Internal placeholder | gasparellodev/team | CC0 (uso interno)    | não                     | —                 |
| porsche-macan-gts     | Internal placeholder | gasparellodev/team | CC0 (uso interno)    | não                     | —                 |
| bmw-i4                | Internal placeholder | gasparellodev/team | CC0 (uso interno)    | não                     | —                 |
| byd-seal              | Internal placeholder | gasparellodev/team | CC0 (uso interno)    | não                     | —                 |
| toyota-gr-corolla     | Internal placeholder | gasparellodev/team | CC0 (uso interno)    | não                     | —                 |
| honda-type-r          | Internal placeholder | gasparellodev/team | CC0 (uso interno)    | não                     | —                 |
| land-rover-defender   | Internal placeholder | gasparellodev/team | CC0 (uso interno)    | não                     | —                 |

**Nota.** `sea-doo-stock.png` permanece em disco mas NÃO está no manifest
V1 (jet ski não cabe em catálogo placeholder de concessionária —
filtragem semântica antes da V2 normalizar a curadoria).

## V2 follow-up — escopo

A curadoria final será rastreada em issue dedicada com escopo:

- ≥ 30 carros totais, mínimo 4 por categoria (`sedan`, `suv`, `picape`,
  `hatch`, `esportivo`).
- Pelo menos 2 fotos `0km` e 2 `seminovo` por categoria.
- Normalização para JPEG 1600×900 (±10%), ≤ 200KB cada.
- Script `scripts/verify-stock-photos.ts` validando dimensão/tamanho/format
  no CI.
- Cada entrada com `source_url`, `autor` e `licença` reais (CC0,
  Unsplash License, Pexels License ou foto própria — todas compatíveis
  com uso comercial).
- Eventual migração de `public/` para Vercel Blob (esta também é V2).

Enquanto V2 não chega, o V1 atende o caminho crítico do M1.4 (#156) e do
M1.7 (#159) sem bloquear o pipeline.
