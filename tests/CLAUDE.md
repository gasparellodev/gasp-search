# `tests/` — Spec Técnica

## Propósito

Suite de testes do projeto: unit/integration (Vitest + RTL) e end-to-end (Playwright).

## Estrutura

```
tests/
├── unit/                # Vitest + jsdom + RTL
│   ├── sanity.test.ts   # smoke do setup
│   ├── lib/             # espelha lib/
│   ├── app/             # specs RTL para Server/Client Components
│   └── components/      # specs RTL para componentes não-shadcn
├── e2e/                 # Playwright (chromium)
│   ├── _helpers/        # auth.ts (login real + skip declarativo)
│   ├── smoke.spec.ts    # carrega `/`
│   ├── responsive.spec.ts # regressão de menu mobile e overflow horizontal
│   └── ...              # fluxos por área (leads, campaigns, whatsapp, integration, pipeline)
└── fixtures/            # JSON fixtures para mappers Apify
```

## Como adicionar

### Unit / Integration (Vitest)
- Crie em `tests/unit/<caminho-espelhado>/<nome>.test.ts(x)`.
- Para componentes React, importe `render`/`screen` de `@testing-library/react`. `userEvent` para interações.
- Imports do projeto via alias `@/...`.
- **TDD obrigatório**: escreva o teste falhando antes da implementação.

### E2E (Playwright)
- Crie em `tests/e2e/<area>/<fluxo>.spec.ts`.
- Use `baseURL` (configurado em `playwright.config.ts`).
- Em CI, roda contra `npm start` (production build); local roda contra `npm run dev`.

### Fixtures
- JSON em `tests/fixtures/<source>/<nome>.json`.
- Não inclua dados pessoais reais. Use payloads sintéticos baseados no shape oficial.

## Regras de negócio

1. **Cobertura ≥ 80% lines/functions, ≥ 75% branches** em `lib/` e `app/api/`. Aplicado via `vitest.config.ts`.
2. **`components/ui/`** (shadcn primitives) está **excluído** do coverage — são gerados pelo CLI.
3. **TDD**: para qualquer lógica de negócio (mappers, validators, server actions, handlers), teste vem antes da implementação.
4. **Testes determinísticos**: nada de `Math.random()`, `Date.now()` direto sem `vi.useFakeTimers()`.
5. **Mock de side effects externos**: Supabase, Apify, Anthropic. Nunca tocar APIs reais em CI.
6. **E2E não depende de Supabase real** em CI (sem secrets); use stubs ou rotas que não exigem auth para smoke. Para testes com auth real, marcar `test.skip()` quando faltar env.
7. **Responsividade**: use helper de overflow horizontal comparando
   `documentElement.scrollWidth`/`body.scrollWidth` contra `clientWidth` nas
   rotas afetadas.

## Comandos

```bash
npm test                # vitest run (uma vez, com coverage no CI)
npm run test:watch      # vitest em watch mode
npm run test:e2e        # playwright test
npm run test:e2e -- --ui   # playwright em modo interativo
```

## Dependências

- `vitest`, `@vitest/coverage-v8`
- `@testing-library/{react,jest-dom,user-event}`
- `jsdom`
- `@vitejs/plugin-react`
- `@playwright/test`

## Quando atualizar este `CLAUDE.md`

- Nova convenção de fixtures.
- Novo browser/device em `playwright.config.ts`.
- Mudança em coverage thresholds.
