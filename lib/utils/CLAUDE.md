# `lib/utils/` — Helpers puros

## Propósito

Helpers determinísticos e síncronos que **não tocam I/O, tokens privados
ou DB**. Podem rodar em qualquer ambiente (server, client, edge, test).

Contraste com `lib/utils.ts` (raiz de `lib/`): aquele tem `cn()` para
classes Tailwind. Esta pasta é para helpers de string, formatação,
parsing e correlatos que cresceram além do arquivo-único.

## Como adicionar

- 1 helper por arquivo, nomeado pela função principal (`slug.ts`,
  `phone.ts`, etc.).
- Sem imports de `server-only`, sem `process.env`, sem clients.
- Funções puras: mesma entrada → mesma saída. Sem side effects.
- TDD obrigatório: teste em `tests/unit/lib/utils/<nome>.test.ts` antes
  da implementação.

## Regras de negócio

1. **Sem dependência de runtime.** Se precisar de `node:` builtins ou
   APIs específicas (Supabase, Apify, Anthropic), o helper não pertence
   aqui — vai pra `lib/<dominio>/`.
2. **Determinismo.** Nada de `Date.now()`, `Math.random()`, leitura de
   env, ou qualquer fonte de não-determinismo dentro do helper. Se
   precisar de aleatoriedade (ex: nanoid), encapsule no caller — esta
   pasta é só transformação.
3. **Sem `any`.** `unknown` + narrowing.

## Arquivos

| Path | Propósito |
|---|---|
| `slug.ts` | `slugify(input)` — NFKD, lowercase, `[^a-z0-9]→-`, collapse, trim, fallback `'lead'`. Usado por `lib/sites/slug.ts` como base e por outros helpers de URL. |

## Dependências

- Nenhuma externa além do TypeScript stdlib + Node `String.normalize`.
