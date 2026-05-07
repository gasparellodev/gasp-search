# `components/search/` — Spec Técnica

## Propósito

Componentes da experiência de busca de leads. A primeira fonte disponível é Google Maps via Apify.

## Regras de negócio

1. Client-side validation usa schemas de `@/lib/validators/search`.
2. Submit chama `POST /api/apify/google-maps`, inicia polling em
   `/api/search-jobs/<id>` e redireciona para `/leads?searchJobId=<id>` quando
   o job termina com sucesso.
3. Mutations disparam toast de sucesso/erro via `sonner`.
4. Loading deve mostrar estado visível, nome do actor, tempo decorrido e desabilitar controles do formulário.
5. Instagram aparece como fonte futura, mas não dispara submit enquanto o handler não existir.
6. Layout mobile não pode criar overflow horizontal: linha de termo empilha em
   mobile, botões usam `w-full sm:w-auto`, chips longos truncam dentro do card.

## Arquivos

| Path | Propósito |
|---|---|
| `search-form.tsx` | Form principal de busca Google Maps |
| `search-progress.tsx` | Estado de execução da busca com spinner, actor, status final e contador em segundos |

## Dependências

- `react-hook-form`
- `@hookform/resolvers/zod`
- `sonner`
- `lucide-react`
- `@/components/ui/*`
- `@/lib/validators/search`
