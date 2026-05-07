# `tests/stubs/` — Spec Técnica

## Propósito

Stubs/no-ops usados como aliases de módulos em `vitest.config.ts` para neutralizar imports que se comportariam diferente em ambiente de teste.

## Como adicionar

1. Crie `tests/stubs/<nome>.ts` exportando o shape mínimo do módulo real.
2. Registre o alias em `vitest.config.ts` → `resolve.alias`.
3. Documente abaixo: qual módulo está sendo stubado e por quê.

## Arquivos

| Path | Substitui | Motivo |
|---|---|---|
| `server-only.ts` | `server-only` (npm) | O pacote real lança em qualquer ambiente client; em tests jsdom precisamos no-op para que módulos server (`lib/env.ts`) carreguem. |
