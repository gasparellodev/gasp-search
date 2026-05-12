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
│   ├── components/      # specs RTL para componentes não-shadcn
│   ├── supabase/migrations/  # validação SQL das migrations (string assertions)
│   └── types/           # type-level tests com expectTypeOf (Database, Enums, Tables<>)
├── e2e/                 # Playwright (chromium)
│   ├── _helpers/        # auth.ts (login real + skip declarativo)
│   ├── smoke.spec.ts    # carrega `/`
│   ├── responsive.spec.ts # regressão de menu mobile e overflow horizontal
│   ├── sites/           # Phase 7 — render público dos sites gerados (#166)
│   └── ...              # fluxos por área (leads, campaigns, whatsapp, integration, pipeline)
└── fixtures/            # JSON fixtures para mappers Apify
```

## Como adicionar

### Unit / Integration (Vitest)
- Crie em `tests/unit/<caminho-espelhado>/<nome>.test.ts(x)`.
- Para componentes React, importe `render`/`screen` de `@testing-library/react`. `userEvent` para interações.
- Imports do projeto via alias `@/...`.
- **TDD obrigatório**: escreva o teste falhando antes da implementação.
- Snapshots de componentes ficam no `__snapshots__/` colocalizado ao spec
  quando o aceite pede baseline estrutural. Mantenha snapshots focados no
  componente afetado e atualize-os só depois da asserção comportamental
  passar.

### E2E (Playwright)
- Crie em `tests/e2e/<area>/<fluxo>.spec.ts`.
- Use `baseURL` (configurado em `playwright.config.ts`).
- Em CI, roda contra `npm start` (production build); local roda contra `npm run dev`.

### Migrations SQL (`tests/unit/supabase/migrations/`)
- Para cada nova migration `supabase/migrations/NNNN_*.sql` adicione `tests/unit/supabase/migrations/NNNN_*.test.ts` que faz `readFileSync` do SQL e usa `toMatch` / `toContain` pra assertar tabelas, índices, RLS policies, triggers e check constraints. CI não roda Postgres real — esse padrão de inspeção do SQL é a defesa primária.

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

## Mock factories

Para evitar duplicação de `vi.mock(...)` ad-hoc em ~20 arquivos, o projeto
mantém helpers centralizados em `tests/__mocks__/` (issue #203 / Sprint 0
#F6). **Use-os para qualquer test novo** que precise mockar Supabase /
Anthropic / Apify.

- `createMockSupabaseClient(opts?)` — client chainable com `.from().select()
  .eq().{single,maybeSingle}()`, `.insert().select().single()`,
  `.update().eq()`, `.upsert()`, `.delete().eq()`. Overrides por tabela:

  ```ts
  import { createMockSupabaseClient } from "@/tests/__mocks__/supabase";

  const supabase = createMockSupabaseClient({
    tables: {
      lead_sites: { maybeSingle: { data: makeLeadSite(), error: null } },
    },
  });
  vi.mock("@/lib/supabase/service", () => ({
    createServiceSupabase: () => supabase,
  }));
  ```

- `anthropicMock()` + `mockAnthropicToolUse(input)` /
  `mockAnthropicTextResponse(text)` — substitui `@anthropic-ai/sdk`.
  `anthropicState.create.mockRejectedValueOnce(err)` simula erro.

  ```ts
  import {
    anthropicMock,
    mockAnthropicToolUse,
    resetAnthropicMock,
  } from "@/tests/__mocks__/anthropic";

  vi.mock("@anthropic-ai/sdk", () => anthropicMock());
  beforeEach(() => {
    resetAnthropicMock();
    mockAnthropicToolUse({ slogan: "X", cars: [] });
  });
  ```

- `apifyMock()` + `mockApifyActorRun(items)` — substitui `apify-client`.

  ```ts
  import {
    apifyMock,
    mockApifyActorRun,
    resetApifyMock,
  } from "@/tests/__mocks__/apify";

  vi.mock("apify-client", () => apifyMock());
  beforeEach(() => {
    resetApifyMock();
    mockApifyActorRun([{ name: "Acme" }]);
  });
  ```

### Fixture factories (`tests/fixtures/`)

Convenção `make<Entity>(overrides?: Partial<T>): T`. Cada factory retorna
instância nova (sem aliasing) e aplica `Partial<T>` shallow:

- `makeSiteVariables(overrides?)` → `SiteVariables` (passa em
  `SiteVariables.parse()`).
- `makeLead(overrides?)` → `Tables<'leads'>`.
- `makeLeadSite(overrides?)` → `Tables<'lead_sites'>` com `variables`
  default do `validSiteVariablesFixture`.

### Site Generator floating CTAs (#220)

- `tests/unit/components/sites/WhatsAppFloatingCTA.test.tsx` cobre render,
  link `general`, safe area, `body[data-modal-open]` e axe.
- `tests/unit/components/sites/FloatingInstallmentBar.test.tsx` cobre render
  mobile, desmontagem real em desktop via `matchMedia`, contexto do carro,
  preço null e axe.
- `tests/unit/lib/hooks/use-car-context.test.tsx` cobre labels/parcela/link
  e mismatch defensivo de `carSlug`.
- `tests/unit/lib/og/load-geist.test.ts` cobre leitura da fonte Geist local
  (`/fonts/geist-600.woff2` no deployment), precedência de `VERCEL_URL` em
  preview, memoização, fallback em falha e timeout de 1s para OG images.
- `tests/unit/lib/seo/indexnow.test.ts` cobre `notifyIndexNow` (#232):
  dedupe, chunks de 10 URLs, POST para os 4 endpoints, warning em falhas
  e no-op quando `INDEXNOW_KEY` não está configurada.

### Quando usar mock factory vs inline `vi.mock`

- **Use factory** quando o test só precisa do shape padrão + 1-2 overrides.
- **Use inline `vi.mock`** quando o test precisa de comportamento exótico
  (Proxy lazy, chained method não suportado pela factory). Documente o
  motivo no top do arquivo.

## `gen:types` — regenerar `types/database.ts`

```bash
# Local (após `supabase start`):
npm run gen:types

# Remoto (requer `SUPABASE_PROJECT_REF` no env):
SUPABASE_PROJECT_REF=<ref> npm run gen:types:remote
```

**Convenção:** ao adicionar migration nova em `supabase/migrations/`,
rodar `gen:types` localmente e commitar `types/database.ts` no mesmo PR.
**NÃO** é um step do CI (requer secret/projeto remoto); a defesa é o
type-level test em `tests/unit/types/database.test.ts` que quebra se
shape divergir.

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
